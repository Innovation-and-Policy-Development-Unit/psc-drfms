"""Advanced search: a list of conditions (field, operator, value) joined by ALL or ANY.

Every field and operator is on an allow-list and turned into an ORM filter, so nothing from the request
reaches the database as raw text. Results are limited to records the user may view.
"""
import math
from datetime import date

from django.contrib.postgres.search import SearchQuery
from django.db.models import Count, OuterRef, Q, Subquery
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.records.authorization import series_with_descendants, visible_records
from apps.records.models import ClassificationLevel, DocumentType, Record, RecordVersion
from apps.records.serializers import RecordListSerializer
from apps.records.views import FILE_TYPE_FILTERS

MAX_CONDITIONS = 15
MAX_PAGE_SIZE = 100

TEXT_OPS = ['contains', 'not_contains', 'equals', 'starts_with', 'is_empty', 'is_not_empty']
CHOICE_OPS = ['is', 'is_not']
DATE_OPS = ['on', 'before', 'after', 'between']

# key -> (label, type, model field or special handler)
FIELDS = {
    'text': ('Any text (full text)', 'fulltext', None),
    'title': ('Title', 'text', 'title'),
    'reference_number': ('Reference number', 'text', 'reference_number'),
    'description': ('Description', 'text', 'description'),
    'originating_ministry': ('Ministry', 'text', 'originating_ministry'),
    'physical_file_ref': ('Physical file reference', 'text', 'physical_file_ref'),
    'physical_location': ('Physical location', 'text', 'physical_location'),
    'document_type': ('Document type', 'choice', 'document_type'),
    'classification_level': ('Classification', 'choice', 'classification_level'),
    'file_type': ('File format', 'choice', None),
    'record_series': ('Record series', 'series', 'record_series_id'),
    'custodian': ('Custodian', 'person', 'custodian_id'),
    'document_date': ('Document date', 'date', 'document_date'),
    'received_date': ('Received date', 'date', 'received_date'),
    'retention_date': ('Retention ends', 'date', 'retention_date'),
    'created_at': ('Date added', 'date', 'created_at__date'),
    'tags': ('Tag', 'tag', 'tags'),
    'is_vital': ('Vital record', 'bool', 'is_vital'),
    'is_on_legal_hold': ('On legal hold', 'bool', 'is_on_legal_hold'),
    'is_draft': ('Draft', 'bool', 'is_draft'),
}
ORDERINGS = {'updated_at', 'created_at', 'title', 'reference_number', 'document_date', 'retention_date'}


def field_catalogue():
    ops = {'text': TEXT_OPS, 'fulltext': ['contains'], 'choice': CHOICE_OPS, 'series': CHOICE_OPS, 'person': CHOICE_OPS,
           'date': DATE_OPS, 'tag': ['has', 'not_has'], 'bool': ['is']}
    choices = {
        'document_type': [{'value': c.value, 'label': c.label} for c in DocumentType],
        'classification_level': [{'value': c.value, 'label': c.label} for c in ClassificationLevel],
        'file_type': [{'value': k, 'label': k.capitalize() if k != 'pdf' else 'PDF'} for k in FILE_TYPE_FILTERS],
    }
    return [
        {'key': key, 'label': label, 'type': kind, 'operators': ops[kind], 'choices': choices.get(key)}
        for key, (label, kind, _) in FIELDS.items()
    ]


class BadCondition(ValueError):
    pass


def _date(value, what):
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError as exc:
        raise BadCondition(f'{what}: "{value}" is not a valid date.') from exc


def condition_q(cond):
    """One condition as a Q. Raises BadCondition with a message a person can act on."""
    key, op, value = cond.get('field'), cond.get('op'), cond.get('value')
    if key not in FIELDS:
        raise BadCondition(f'Unknown field "{key}".')
    label, kind, target = FIELDS[key]
    if op not in field_ops(kind):
        raise BadCondition(f'{label}: "{op}" does not apply here.')
    needs_value = op not in ('is_empty', 'is_not_empty')
    if needs_value and (value is None or str(value).strip() == ''):
        raise BadCondition(f'{label}: enter a value.')
    text = str(value).strip()[:300] if value is not None else ''

    if kind == 'fulltext':
        return Q(search_vector=SearchQuery(text, config='english', search_type='websearch')) | Q(title__icontains=text)
    if kind == 'text':
        return {
            'contains': Q(**{f'{target}__icontains': text}),
            'not_contains': ~Q(**{f'{target}__icontains': text}),
            'equals': Q(**{f'{target}__iexact': text}),
            'starts_with': Q(**{f'{target}__istartswith': text}),
            'is_empty': Q(**{target: ''}),
            'is_not_empty': ~Q(**{target: ''}),
        }[op]
    if kind == 'choice':
        if key == 'file_type':
            if text not in FILE_TYPE_FILTERS:
                raise BadCondition(f'{label}: unknown format.')
            q = FILE_TYPE_FILTERS[text]
        else:
            valid = DocumentType.values if key == 'document_type' else ClassificationLevel.values
            if text not in valid:
                raise BadCondition(f'{label}: unknown value "{text}".')
            q = Q(**{target: text})
        return q if op == 'is' else ~q
    if kind in ('series', 'person'):
        if not text.isdigit():
            raise BadCondition(f'{label}: choose a value from the list.')
        if kind == 'series':
            q = Q(record_series_id__in=series_with_descendants(int(text)))
        else:
            q = Q(custodian_id=int(text))
        return q if op == 'is' else ~q
    if kind == 'date':
        first = _date(text, label)
        if op == 'on':
            return Q(**{target: first})
        if op == 'before':
            return Q(**{f'{target}__lt': first})
        if op == 'after':
            return Q(**{f'{target}__gt': first})
        second = _date(cond.get('value2'), label)
        if second < first:
            raise BadCondition(f'{label}: the end date is before the start date.')
        return Q(**{f'{target}__gte': first, f'{target}__lte': second})
    if kind == 'tag':
        q = Q(tags__contains=[text.lower()])
        return q if op == 'has' else ~q
    if kind == 'bool':
        return Q(**{target: str(value).lower() in ('true', '1', 'yes')})
    raise BadCondition(f'{label}: not supported.')


def field_ops(kind):
    return {'text': TEXT_OPS, 'fulltext': ['contains'], 'choice': CHOICE_OPS, 'series': CHOICE_OPS, 'person': CHOICE_OPS,
            'date': DATE_OPS, 'tag': ['has', 'not_has'], 'bool': ['is']}[kind]


class AdvancedSearchFieldsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'fields': field_catalogue()})


class AdvancedSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        conditions = request.data.get('conditions') or []
        if not isinstance(conditions, list) or not conditions:
            return Response({'detail': 'Add at least one condition.'}, status=400)
        if len(conditions) > MAX_CONDITIONS:
            return Response({'detail': f'Use at most {MAX_CONDITIONS} conditions.'}, status=400)
        parts = []
        try:
            for c in conditions:
                if not isinstance(c, dict):
                    raise BadCondition('Malformed condition.')
                parts.append(condition_q(c))
        except BadCondition as exc:
            return Response({'detail': str(exc)}, status=400)

        combined = parts[0]
        for q in parts[1:]:
            combined = (combined | q) if request.data.get('match') == 'any' else (combined & q)

        latest = RecordVersion.objects.filter(record=OuterRef('pk')).order_by('-version_number')
        qs = (
            visible_records(request.user, Record.objects.filter(destroyed_at__isnull=True))
            .annotate(
                version_count=Count('versions', distinct=True),
                file_name=Subquery(latest.values('file_name')[:1]),
                mime_type=Subquery(latest.values('mime_type')[:1]),
                file_size=Subquery(latest.values('file_size')[:1]),
            )
            .select_related('record_series', 'custodian')
            .filter(combined)
            .distinct()
        )
        ordering = request.data.get('ordering') or '-updated_at'
        if ordering.lstrip('-') not in ORDERINGS:
            ordering = '-updated_at'
        try:
            page = max(1, int(request.data.get('page', 1)))
            size = min(MAX_PAGE_SIZE, max(1, int(request.data.get('page_size', 25))))
        except (TypeError, ValueError):
            page, size = 1, 25
        total = qs.count()
        rows = list(qs.order_by(ordering, '-created_at')[(page - 1) * size: page * size])
        return Response({
            'count': total, 'page': page, 'pages': max(1, math.ceil(total / size)),
            'results': RecordListSerializer(rows, many=True, context={'request': request}).data,
        })
