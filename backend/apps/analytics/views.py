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


# --- Per-viewer activity (respects what the viewer is allowed to see) -------

ACTIVITY_RANGES = (7, 14, 30, 90)
FEED_ACTIONS = (
    'create', 'update', 'upload_version', 'approve', 'reject', 'share',
    'sign', 'legal_hold', 'legal_hold_lift', 'custody_transfer',
)


class ActivityView(APIView):
    """Documents added and record edits per day, plus how the period compares with the last."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models.functions import TruncDate
        from apps.audit.models import AuditLog
        from apps.records.authorization import viewable_records
        from apps.records.models import RecordVersion

        try:
            days = int(request.query_params.get('days', 14))
        except ValueError:
            days = 14
        days = days if days in ACTIVITY_RANGES else 14

        today = timezone.localdate()
        start = today - timedelta(days=days - 1)
        previous_start = start - timedelta(days=days)

        records = viewable_records(request.user)
        record_ids = records.values('pk')

        def per_day(qs, field):
            rows = (
                qs.filter(**{f'{field}__date__gte': start})
                .annotate(day=TruncDate(field)).values('day').annotate(n=Count('pk'))
            )
            return {r['day']: r['n'] for r in rows}

        added = per_day(RecordVersion.objects.filter(record__in=record_ids), 'created_at')
        edited = per_day(AuditLog.objects.filter(action='update', record__in=record_ids), 'timestamp')

        series = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            series.append({'date': day.isoformat(), 'uploads': added.get(day, 0), 'edits': edited.get(day, 0)})

        current = records.filter(created_at__date__gte=start).count()
        previous = records.filter(created_at__date__gte=previous_start, created_at__date__lt=start).count()
        return Response({
            'days': days,
            'series': series,
            'records_added': current,
            'previous_records_added': previous,
            # None when there is nothing earlier to compare with
            'records_trend_pct': round((current - previous) / previous * 100) if previous else None,
        })


class TeamFeedView(APIView):
    """Recent meaningful actions by colleagues, only on records the viewer may see."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.audit.models import AuditLog
        from apps.records.authorization import viewable_records

        try:
            limit = min(20, max(1, int(request.query_params.get('limit', 8))))
        except ValueError:
            limit = 8

        logs = (
            AuditLog.objects
            .filter(action__in=FEED_ACTIONS, record__in=viewable_records(request.user).values('pk'))
            .select_related('user', 'record')
            .order_by('-timestamp')[:limit]
        )
        return Response([
            {
                'id': str(log.pk),
                'action': log.action,
                'user_name': (log.user.get_full_name() or log.user.email) if log.user else 'System',
                'record_id': str(log.record_id),
                'record_title': log.record.title,
                'reference_number': log.record.reference_number,
                'timestamp': log.timestamp,
            }
            for log in logs
        ])
