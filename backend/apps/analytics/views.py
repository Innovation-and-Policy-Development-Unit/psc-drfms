from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.utils import timezone
from django.db.models import Count
from datetime import timedelta
from apps.accounts.permissions import IsDirectorOrAbove
from .cache_utils import (
    cached_analytics,
    dashboard_stats_payload,
    compliance_dashboard_payload,
    workflow_performance_payload,
    records_by_type_payload,
    analytics_overview_payload,
)


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        data = cached_analytics('analytics:dashboard_stats', 300, dashboard_stats_payload)
        return Response(data)


class AnalyticsOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        data = cached_analytics('analytics:overview', 300, analytics_overview_payload)
        return Response(data)


class RecordsByTypeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        return Response(cached_analytics('analytics:records_by_type', 300, records_by_type_payload))


class RecordsByMonthView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        from apps.records.models import Record
        from django.db.models.functions import TruncMonth
        data = (
            Record.objects.filter(created_at__gte=timezone.now() - timedelta(days=365))
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        return Response([{'month': d['month'].strftime('%Y-%m'), 'count': d['count']} for d in data])


class WorkflowPerformanceView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        return Response(cached_analytics('analytics:workflow_performance', 300, workflow_performance_payload))


class UserActivityView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        from apps.audit.models import AuditLog
        thirty_days_ago = timezone.now() - timedelta(days=30)
        data = (
            AuditLog.objects.filter(timestamp__gte=thirty_days_ago)
            .values('user__email', 'user__first_name', 'user__last_name')
            .annotate(action_count=Count('id'))
            .order_by('-action_count')[:20]
        )
        return Response(list(data))


class ComplianceDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        return Response(cached_analytics('analytics:compliance_dashboard', 300, compliance_dashboard_payload))
