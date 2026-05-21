from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.utils import timezone
from django.db.models import Count, Q
from datetime import timedelta
from apps.accounts.permissions import IsDirectorOrAbove


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.records.models import Record
        from apps.workflows.models import WorkflowInstance
        from apps.compliance.models import LegalHold

        today = timezone.now().date()
        thirty_days_ago = today - timedelta(days=30)

        total_records = Record.objects.filter(destroyed_at__isnull=True).count()
        records_this_month = Record.objects.filter(created_at__date__gte=thirty_days_ago).count()
        on_legal_hold = Record.objects.filter(is_on_legal_hold=True).count()
        vital_records = Record.objects.filter(is_vital=True).count()
        pending_workflows = WorkflowInstance.objects.filter(status='in_progress').count()
        overdue_records = Record.objects.filter(
            retention_date__lt=today,
            destroyed_at__isnull=True,
            is_vital=False,
            is_on_legal_hold=False,
        ).count()
        active_holds = LegalHold.objects.filter(is_active=True).count()

        return Response({
            'total_records': total_records,
            'records_this_month': records_this_month,
            'on_legal_hold': on_legal_hold,
            'vital_records': vital_records,
            'pending_workflows': pending_workflows,
            'overdue_records': overdue_records,
            'active_legal_holds': active_holds,
        })


class RecordsByTypeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        from apps.records.models import Record
        data = Record.objects.filter(destroyed_at__isnull=True).values('document_type').annotate(count=Count('id')).order_by('-count')
        return Response(list(data))


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
        from apps.workflows.models import WorkflowInstance
        from django.db.models import Avg, F, ExpressionWrapper, DurationField

        completed = WorkflowInstance.objects.filter(
            status='approved',
            completed_at__isnull=False,
        ).annotate(
            duration=ExpressionWrapper(
                F('completed_at') - F('initiated_at'),
                output_field=DurationField()
            )
        )

        avg_days = None
        if completed.exists():
            avg_dur = completed.aggregate(avg=Avg('duration'))['avg']
            if avg_dur:
                avg_days = round(avg_dur.days + avg_dur.seconds / 86400, 1)

        overdue_steps = 0
        from apps.workflows.models import WorkflowAction
        overdue_steps = WorkflowAction.objects.filter(
            action='pending',
            deadline__lt=timezone.now(),
        ).count()

        return Response({
            'average_completion_days': avg_days,
            'overdue_steps': overdue_steps,
            'total_completed': completed.count(),
            'total_in_progress': WorkflowInstance.objects.filter(status='in_progress').count(),
        })


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
        from apps.records.models import Record
        from apps.compliance.models import LegalHold, DestructionCertificate

        today = timezone.now().date()
        return Response({
            'overdue_records': Record.objects.filter(retention_date__lt=today, destroyed_at__isnull=True, is_vital=False, is_on_legal_hold=False).count(),
            'incomplete_metadata': Record.objects.filter(Q(description='') | Q(record_series__isnull=True), destroyed_at__isnull=True).count(),
            'active_legal_holds': LegalHold.objects.filter(is_active=True).count(),
            'pending_destructions': DestructionCertificate.objects.filter(status='pending').count(),
            'vital_records': Record.objects.filter(is_vital=True, destroyed_at__isnull=True).count(),
        })
