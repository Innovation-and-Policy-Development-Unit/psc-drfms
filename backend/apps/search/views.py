import re

from django.contrib.postgres.search import SearchQuery, SearchRank, TrigramSimilarity, TrigramWordSimilarity
from django.db.models import Count, F, FloatField, Q, Value
from django.db.models.functions import ExtractYear, Greatest
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.records.authorization import visible_records_q
from apps.records.models import Record, RecordVersion
from apps.records.serializers import RecordListSerializer

from .models import NoResultSearch

MAX_PAGE_SIZE = 50
# word_similarity(query, title): how well the typed word(s) match some part of the title
WORD_SIM_MIN = 0.4
FACET_FILTERS = {
    'document_type': 'document_type',
    'classification_level': 'classification_level',
    'record_series': 'record_series_id',
}


def _build_snippet(text: str, query: str, radius: int = 60) -> str:
    if not text or not query:
        return ''
    idx = text.lower().find(query.lower())
    if idx == -1:
        return text[:140].strip() + ('…' if len(text) > 140 else '')
    start = max(0, idx - radius)
    end = min(len(text), idx + len(query) + radius)
    snippet = re.sub(r'\s+', ' ', text[start:end]).strip()
    return ('…' if start > 0 else '') + snippet + ('…' if end < len(text) else '')


def _longest_term(query: str) -> str:
    terms = re.findall(r'[\w-]+', query)
    return max(terms, key=len) if terms else query


def _facet(qs, field):
    """Top values of ``field`` among ``qs`` with their counts."""
    if field in ('originating_ministry', 'document_type', 'classification_level'):
        qs = qs.exclude(**{field: ''})
    rows = qs.values(field).annotate(n=Count('id')).order_by('-n')[:15]
    return [{'value': str(r[field]), 'count': r['n']} for r in rows]


class UnifiedSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        params = request.query_params
        query = params.get('q', '').strip()[:200]

        try:
            page = max(1, int(params.get('page', 1)))
            page_size = min(MAX_PAGE_SIZE, max(1, int(params.get('page_size', 20))))
        except ValueError:
            page, page_size = 1, 20

        base = Record.objects.filter(destroyed_at__isnull=True).filter(visible_records_q(request.user))

        if params.get('date_from'):
            base = base.filter(document_date__gte=params['date_from'])
        if params.get('date_to'):
            base = base.filter(document_date__lte=params['date_to'])

        if query:
            search_query = SearchQuery(query, config='english', search_type='websearch')
            base = base.annotate(
                rank=SearchRank(F('search_vector'), search_query),
                sim=Greatest(
                    TrigramWordSimilarity(query, 'title'),
                    TrigramSimilarity('reference_number', query),
                    output_field=FloatField(),
                ),
            ).filter(
                Q(search_vector=search_query)
                | Q(sim__gte=WORD_SIM_MIN)
                | Q(reference_number__icontains=query)
                | Q(title__icontains=query)
                | Q(originating_ministry__icontains=query)
            ).annotate(score=F('rank') + F('sim'))
            ordering = ['-score', '-created_at']
        else:
            base = base.annotate(score=Value(0.0, output_field=FloatField()))
            ordering = ['-created_at']

        # Each facet is counted with the *other* filters applied, so choosing one
        # value does not erase the alternatives.
        def apply(qs, skip=None):
            for param, field in FACET_FILTERS.items():
                if param != skip and params.get(param):
                    qs = qs.filter(**{field: params[param]})
            if skip != 'ministry' and params.get('ministry'):
                qs = qs.filter(originating_ministry=params['ministry'])
            if skip != 'year' and params.get('year'):
                qs = qs.filter(document_date__year=params['year'])
            return qs

        facets = {
            'documentType': _facet(apply(base, 'document_type'), 'document_type'),
            'classificationLevel': _facet(apply(base, 'classification_level'), 'classification_level'),
            'ministry': _facet(apply(base, 'ministry'), 'originating_ministry'),
            'year': [
                {'value': str(r['y']), 'count': r['n']}
                for r in apply(base, 'year').filter(document_date__isnull=False)
                .annotate(y=ExtractYear('document_date')).values('y')
                .annotate(n=Count('id')).order_by('-y')[:12]
            ],
        }

        qs = apply(base).select_related('record_series', 'custodian').order_by(*ordering)
        total = qs.count()
        offset = (page - 1) * page_size
        page_qs = list(qs[offset:offset + page_size])

        term = _longest_term(query) if query else ''
        hits = {}
        if term and page_qs:
            for v in RecordVersion.objects.filter(
                record_id__in=[r.id for r in page_qs], ocr_text__icontains=term,
            ).only('record_id', 'ocr_text'):
                hits.setdefault(v.record_id, v.ocr_text)

        serialized = RecordListSerializer(page_qs, many=True, context={'request': request}).data
        results = []
        for record, data in zip(page_qs, serialized):
            snippet = _build_snippet(hits.get(record.id, ''), term)
            if not snippet and term and term.lower() in (record.description or '').lower():
                snippet = _build_snippet(record.description, term)
            data['match_snippet'] = snippet
            data['rank'] = float(getattr(record, 'score', 0) or 0)
            results.append(data)

        did_you_mean = None
        if query and total == 0:
            obj, created = NoResultSearch.objects.get_or_create(query=query.lower())
            if not created:
                NoResultSearch.objects.filter(pk=obj.pk).update(count=F('count') + 1)
            did_you_mean = (
                Record.objects.filter(destroyed_at__isnull=True)
                .filter(visible_records_q(request.user))
                .annotate(sim=TrigramWordSimilarity(query, 'title')).filter(sim__gte=0.25)
                .order_by('-sim').values_list('title', flat=True).first()
            )

        return Response({
            'results': results,
            'count': total,
            'page': page,
            'pageSize': page_size,
            'pages': max(1, -(-total // page_size)),
            'query': query,
            'facets': facets,
            'didYouMean': did_you_mean,
        })


class SearchSuggestView(APIView):
    """Typeahead for the command palette: a handful of best matches, fast."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()[:100]
        if len(query) < 2:
            return Response([])
        rows = (
            Record.objects.filter(destroyed_at__isnull=True)
            .filter(visible_records_q(request.user))
            .annotate(sim=Greatest(
                TrigramWordSimilarity(query, 'title'),
                TrigramSimilarity('reference_number', query),
                output_field=FloatField(),
            ))
            .filter(
                Q(reference_number__icontains=query)
                | Q(title__icontains=query)
                | Q(sim__gte=WORD_SIM_MIN)
            )
            .order_by('-sim', '-created_at')
            .values('id', 'reference_number', 'title', 'document_type', 'classification_level')[:8]
        )
        return Response([
            {
                'id': str(r['id']),
                'referenceNumber': r['reference_number'],
                'title': r['title'],
                'documentType': r['document_type'],
                'classificationLevel': r['classification_level'],
            }
            for r in rows
        ])


class SearchAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        top_no_results = NoResultSearch.objects.order_by('-count')[:20]
        return Response([
            {'query': s.query, 'count': s.count, 'lastSearched': s.last_searched}
            for s in top_no_results
        ])
