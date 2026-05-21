from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, serializers
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchHeadline
from django.db.models import Q, F
from apps.records.models import Record
from apps.records.serializers import RecordListSerializer


class UnifiedSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'results': [], 'count': 0, 'query': ''})

        # Log search
        SearchQuery_pg = SearchQuery(query, config='english')

        qs = Record.objects.filter(
            destroyed_at__isnull=True
        ).filter(
            Q(search_vector=SearchQuery_pg) |
            Q(title__icontains=query) |
            Q(reference_number__icontains=query) |
            Q(description__icontains=query) |
            Q(originating_ministry__icontains=query)
        )

        # Apply filters
        doc_type = request.query_params.get('document_type')
        ministry = request.query_params.get('ministry')
        series = request.query_params.get('record_series')
        classification = request.query_params.get('classification_level')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        if doc_type:
            qs = qs.filter(document_type=doc_type)
        if ministry:
            qs = qs.filter(originating_ministry__icontains=ministry)
        if series:
            qs = qs.filter(record_series_id=series)
        if classification:
            qs = qs.filter(classification_level=classification)
        if date_from:
            qs = qs.filter(document_date__gte=date_from)
        if date_to:
            qs = qs.filter(document_date__lte=date_to)

        qs = qs.annotate(
            rank=SearchRank(F('search_vector'), SearchQuery_pg)
        ).order_by('-rank', '-created_at').distinct()[:50]

        # Log no-result queries for analytics
        results = RecordListSerializer(qs, many=True).data
        if not results:
            NoResultSearch.objects.get_or_create(query=query.lower())

        return Response({
            'results': results,
            'count': len(results),
            'query': query,
        })


class SavedSearch(object):
    pass


from django.db import models as dm


class NoResultSearch(dm.Model):
    query = dm.CharField(max_length=500, unique=True)
    count = dm.PositiveIntegerField(default=1)
    last_searched = dm.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'search'


class SearchAnalyticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        top_no_results = NoResultSearch.objects.order_by('-count')[:20]
        return Response([
            {'query': s.query, 'count': s.count, 'last_searched': s.last_searched}
            for s in top_no_results
        ])
