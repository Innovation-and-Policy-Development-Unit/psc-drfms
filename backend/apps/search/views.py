import re

from django.contrib.postgres.search import SearchQuery, SearchRank, TrigramSimilarity, TrigramWordSimilarity
from django.db.models import Case, Count, F, FloatField, Q, Value, When
from django.db.models.functions import ExtractYear, Greatest
from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.records.authorization import ensure_record_access
from apps.records.models import Record, RecordVersion
from apps.records.serializers import RecordListSerializer

from .embeddings import is_external, service_status
from .models import NoResultSearch, RecordChunk
from .semantic import similar_records, semantic_hits, visible_records

MAX_PAGE_SIZE = 50
# word_similarity(query, title): how well the typed word(s) match some part of the title
WORD_SIM_MIN = 0.4
FACET_FILTERS = {
    'document_type': 'document_type',
    'classification_level': 'classification_level',
    'record_series': 'record_series_id',
    'custodian': 'custodian_id',
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

        base = visible_records(request.user)

        if params.get('date_from'):
            base = base.filter(document_date__gte=params['date_from'])
        if params.get('date_to'):
            base = base.filter(document_date__lte=params['date_to'])

        # Meaning-based matches (empty when disabled, unavailable or mode=keyword)
        meaning = {}
        if query and params.get('mode') != 'keyword':
            meaning = semantic_hits(request.user, query)

        if query:
            search_query = SearchQuery(query, config='english', search_type='websearch')
            base = base.annotate(
                rank=SearchRank(F('search_vector'), search_query),
                sim=Greatest(
                    TrigramWordSimilarity(query, 'title'),
                    TrigramSimilarity('reference_number', query),
                    output_field=FloatField(),
                ),
                meaning_sim=Case(
                    *[When(pk=pk, then=Value(hit.similarity)) for pk, hit in meaning.items()],
                    default=Value(0.0),
                    output_field=FloatField(),
                ),
            ).filter(
                Q(search_vector=search_query)
                | Q(sim__gte=WORD_SIM_MIN)
                | Q(reference_number__icontains=query)
                | Q(title__icontains=query)
                | Q(originating_ministry__icontains=query)
                | Q(pk__in=list(meaning))
            ).annotate(score=F('rank') + F('sim') + F('meaning_sim'))
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
            'recordSeries': [
                {'value': str(r['record_series_id']), 'label': r['record_series__name'], 'count': r['n']}
                for r in apply(base, 'record_series').filter(record_series__isnull=False)
                .values('record_series_id', 'record_series__name')
                .annotate(n=Count('id')).order_by('-n')[:12]
            ],
            'custodian': [
                {
                    'value': str(r['custodian_id']),
                    'label': (r['custodian__first_name'] + ' ' + r['custodian__last_name']).strip() or r['custodian__email'],
                    'count': r['n'],
                }
                for r in apply(base, 'custodian').filter(custodian__isnull=False)
                .values('custodian_id', 'custodian__first_name', 'custodian__last_name', 'custodian__email')
                .annotate(n=Count('id')).order_by('-n')[:12]
            ],
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
            meaning_hit = meaning.get(record.id)
            if not snippet and meaning_hit:
                snippet = meaning_hit.snippet[:160].strip() + ('…' if len(meaning_hit.snippet) > 160 else '')

            # How this record matched: the words, the meaning, or both
            by_words = (
                (getattr(record, 'rank', 0) or 0) > 1e-4  # SearchRank is ~1e-20, not 0, for non-matches
                or (getattr(record, 'sim', 0) or 0) >= WORD_SIM_MIN
                or query.lower() in f'{record.title} {record.reference_number}'.lower()
            ) if query else False
            data['match_snippet'] = snippet
            data['rank'] = float(getattr(record, 'score', 0) or 0)
            data['matched_by'] = (
                'both' if by_words and meaning_hit else 'meaning' if meaning_hit else 'keyword'
            ) if query else None
            results.append(data)

        did_you_mean = None
        if query and total == 0:
            obj, created = NoResultSearch.objects.get_or_create(query=query.lower())
            if not created:
                NoResultSearch.objects.filter(pk=obj.pk).update(count=F('count') + 1)
            did_you_mean = (
                visible_records(request.user)
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
            'meaningMatches': len(meaning),
            # True when the query text was sent to an outside provider to find them
            'meaningExternal': bool(query and params.get('mode') != 'keyword' and is_external()),
        })


class SearchSuggestView(APIView):
    """Typeahead for the command palette: a handful of best matches, fast."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()[:100]
        if len(query) < 2:
            return Response([])
        rows = (
            visible_records(request.user)
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


class SimilarRecordsView(APIView):
    """Records closest in meaning to one record ("more like this")."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, "view")
        found = similar_records(request.user, record)
        return Response({
            "indexed": found is not None,
            "results": [
                {
                    "id": str(r.pk),
                    "referenceNumber": r.reference_number,
                    "title": r.title,
                    "documentType": r.document_type,
                    "classificationLevel": r.classification_level,
                    "originatingMinistry": r.originating_ministry,
                    "similarity": round(hit.similarity, 3),
                }
                for r, hit in (found or [])
            ],
        })


class SemanticStatusView(APIView):
    """Lets the UI and admins see whether meaning-based search is working."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        status = service_status()
        total = Record.objects.filter(destroyed_at__isnull=True).count()
        indexed = RecordChunk.objects.values("record_id").distinct().count()
        return Response({**status, "indexedRecords": indexed, "totalRecords": total})
