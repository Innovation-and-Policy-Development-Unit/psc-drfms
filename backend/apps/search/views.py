from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import Q, F, Prefetch
from apps.records.models import Record, RecordVersion
from apps.records.serializers import RecordListSerializer
from .models import NoResultSearch


def _build_snippet(text: str, query: str, radius: int = 40) -> str:
    if not text or not query:
        return ''
    lower = text.lower()
    q = query.lower()
    idx = lower.find(q)
    if idx == -1:
        return text[:120].strip() + ('…' if len(text) > 120 else '')
    start = max(0, idx - radius)
    end = min(len(text), idx + len(query) + radius)
    snippet = text[start:end].strip()
    if start > 0:
        snippet = '…' + snippet
    if end < len(text):
        snippet = snippet + '…'
    return snippet


class UnifiedSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'results': [], 'count': 0, 'query': ''})

        search_query = SearchQuery(query, config='english')

        qs = (
            Record.objects.filter(destroyed_at__isnull=True)
            .select_related('record_series', 'custodian')
            .prefetch_related(
                Prefetch(
                    'versions',
                    queryset=RecordVersion.objects.filter(ocr_text__icontains=query).only('id', 'record_id', 'ocr_text')[:1],
                    to_attr='_ocr_hits',
                )
            )
            .filter(
                Q(search_vector=search_query)
                | Q(title__icontains=query)
                | Q(reference_number__icontains=query)
                | Q(description__icontains=query)
                | Q(originating_ministry__icontains=query)
                | Q(versions__ocr_text__icontains=query)
            )
        )

        for param, field in [
            ('document_type', 'document_type'),
            ('record_series', 'record_series_id'),
            ('classification_level', 'classification_level'),
        ]:
            val = request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val})

        ministry = request.query_params.get('ministry')
        if ministry:
            qs = qs.filter(originating_ministry__icontains=ministry)
        if request.query_params.get('date_from'):
            qs = qs.filter(document_date__gte=request.query_params['date_from'])
        if request.query_params.get('date_to'):
            qs = qs.filter(document_date__lte=request.query_params['date_to'])

        qs = (
            qs.annotate(rank=SearchRank(F('search_vector'), search_query))
            .order_by('-rank', '-created_at')
            .distinct()[:50]
        )

        serialized = RecordListSerializer(qs, many=True, context={'request': request}).data
        results = []
        for record, data in zip(qs, serialized):
            ocr_hit = getattr(record, '_ocr_hits', None)
            snippet = _build_snippet(ocr_hit[0].ocr_text, query) if ocr_hit else ''
            if not snippet and query.lower() in (data.get('title') or '').lower():
                snippet = _build_snippet(data['title'], query)
            data['match_snippet'] = snippet
            data['rank'] = float(getattr(record, 'rank', 0) or 0)
            results.append(data)

        if not results:
            obj, created = NoResultSearch.objects.get_or_create(query=query.lower())
            if not created:
                NoResultSearch.objects.filter(pk=obj.pk).update(count=F('count') + 1)

        return Response({'results': results, 'count': len(results), 'query': query})


class SearchAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        top_no_results = NoResultSearch.objects.order_by('-count')[:20]
        return Response([
            {'query': s.query, 'count': s.count, 'lastSearched': s.last_searched}
            for s in top_no_results
        ])
