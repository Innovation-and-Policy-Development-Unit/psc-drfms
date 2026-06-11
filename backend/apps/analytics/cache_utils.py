from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta


def cached_analytics(key: str, ttl_seconds: int, builder):
    """Return cached analytics payload or rebuild and store."""
    data = cache.get(key)
    if data is None:
        data = builder()
        cache.set(key, data, ttl_seconds)
    return data


def dashboard_stats_payload():
    from apps.records.models import Record
    from apps.workflows.models import WorkflowInstance
    from apps.compliance.models import LegalHold

    today = timezone.now().date()
    thirty_days_ago = today - timedelta(days=30)

    return {
        'total_records': Record.objects.filter(destroyed_at__isnull=True).count(),
        'records_this_month': Record.objects.filter(created_at__date__gte=thirty_days_ago).count(),
        'on_legal_hold': Record.objects.filter(is_on_legal_hold=True).count(),
        'vital_records': Record.objects.filter(is_vital=True).count(),
        'pending_workflows': WorkflowInstance.objects.filter(status='in_progress').count(),
        'overdue_records': Record.objects.filter(
            retention_date__lt=today,
            destroyed_at__isnull=True,
            is_vital=False,
            is_on_legal_hold=False,
        ).count(),
        'active_legal_holds': LegalHold.objects.filter(is_active=True).count(),
    }


def compliance_dashboard_payload():
    from apps.records.models import Record
    from apps.compliance.models import LegalHold, DestructionCertificate
    from django.db.models import Q

    today = timezone.now().date()
    return {
        'overdue_records': Record.objects.filter(
            retention_date__lt=today,
            destroyed_at__isnull=True,
            is_vital=False,
            is_on_legal_hold=False,
        ).count(),
        'incomplete_metadata': Record.objects.filter(
            Q(description='') | Q(record_series__isnull=True),
            destroyed_at__isnull=True,
        ).count(),
        'active_legal_holds': LegalHold.objects.filter(is_active=True).count(),
        'pending_destructions': DestructionCertificate.objects.filter(status='pending').count(),
        'vital_records': Record.objects.filter(is_vital=True, destroyed_at__isnull=True).count(),
    }


def workflow_performance_payload():
    from apps.workflows.models import WorkflowInstance, WorkflowAction
    from django.db.models import Avg, F, ExpressionWrapper, DurationField

    completed = WorkflowInstance.objects.filter(
        status='approved',
        completed_at__isnull=False,
    ).annotate(
        duration=ExpressionWrapper(
            F('completed_at') - F('initiated_at'),
            output_field=DurationField(),
        )
    )

    avg_days = None
    if completed.exists():
        avg_dur = completed.aggregate(avg=Avg('duration'))['avg']
        if avg_dur:
            avg_days = round(avg_dur.days + avg_dur.seconds / 86400, 1)

    overdue_steps = WorkflowAction.objects.filter(
        action='pending',
        deadline__lt=timezone.now(),
    ).count()

    return {
        'average_completion_days': avg_days,
        'overdue_steps': overdue_steps,
        'total_completed': completed.count(),
        'total_in_progress': WorkflowInstance.objects.filter(status='in_progress').count(),
    }


def records_by_type_payload():
    from apps.records.models import Record
    from django.db.models import Count

    return list(
        Record.objects.filter(destroyed_at__isnull=True)
        .values('document_type')
        .annotate(count=Count('id'))
        .order_by('-count')
    )


def analytics_overview_payload():
    return {
        'stats': dashboard_stats_payload(),
        'compliance': compliance_dashboard_payload(),
        'workflow': workflow_performance_payload(),
        'records_by_type': records_by_type_payload(),
    }
