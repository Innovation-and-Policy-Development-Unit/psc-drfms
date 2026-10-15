"""
Retention disposition scan — the job that closes the retention loop.

Nightly (via Celery beat) it:
1. Backfills ``retention_date`` for records that have a series but no date.
2. Flags records past retention (not on legal hold, not vital, not destroyed)
   by opening a DispositionReview with the action proposed by the series'
   retention schedule.
3. Notifies records officers and administrators with a summary.

Approving a review does not destroy anything — destruction still goes through
the DestructionCertificate flow; the review queue is the gate in front of it.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)

# A dismissed review suppresses re-flagging of the same record for this long.
REFLAG_AFTER_DISMISSAL_DAYS = 365


def _backfill_retention_dates():
    from apps.records.models import Record

    updated = 0
    candidates = Record.objects.filter(
        retention_date__isnull=True,
        record_series__isnull=False,
        destroyed_at__isnull=True,
    ).select_related('record_series__retention_schedule')
    for record in candidates.iterator():
        series = record.record_series
        schedule = getattr(series, 'retention_schedule', None)
        years = schedule.retention_years if schedule else series.retention_years
        base = record.document_date or record.created_at.date()
        try:
            record.retention_date = base.replace(year=base.year + years)
        except ValueError:  # 29 Feb base date in a non-leap target year
            record.retention_date = base.replace(year=base.year + years, day=28)
        record.save(update_fields=['retention_date'])
        updated += 1
    return updated


def _flag_due_records(today):
    from apps.compliance.models import DispositionReview
    from apps.records.models import Record

    reflag_cutoff = timezone.now() - timedelta(days=REFLAG_AFTER_DISMISSAL_DAYS)
    due = (
        Record.objects.filter(
            retention_date__lte=today,
            destroyed_at__isnull=True,
            is_on_legal_hold=False,
            is_vital=False,
        )
        .exclude(disposition_reviews__status='pending')
        .exclude(disposition_reviews__status='approved')
        .exclude(
            disposition_reviews__status='dismissed',
            disposition_reviews__decided_at__gte=reflag_cutoff,
        )
        .select_related('record_series__retention_schedule')
    )

    flagged = []
    for record in due.iterator():
        schedule = getattr(record.record_series, 'retention_schedule', None) if record.record_series else None
        if schedule and not schedule.auto_flag_for_review:
            continue
        review = DispositionReview.objects.create(
            record=record,
            retention_date=record.retention_date,
            proposed_action=schedule.disposition_action if schedule else 'review',
        )
        flagged.append(review)
    return flagged


def _notify_officers(flagged_count):
    from apps.accounts.models import User, UserRole
    from apps.notifications.utils import send_notification

    recipients = User.objects.filter(
        is_active=True,
        role__in=[UserRole.RECORDS_OFFICER, UserRole.ADMINISTRATOR],
    )
    for user in recipients:
        send_notification(
            user_id=user.id,
            title='Records due for disposition review',
            message=(
                f'{flagged_count} record(s) have reached the end of their retention '
                f'period and await disposition review.'
            ),
            notification_type='deadline',
            related_url='/compliance/retention',
        )


@shared_task
def scan_retention_due():
    today = timezone.localdate()
    backfilled = _backfill_retention_dates()
    flagged = _flag_due_records(today)
    if flagged:
        _notify_officers(len(flagged))
    logger.info(
        'Retention scan: %s retention dates backfilled, %s records flagged for disposition.',
        backfilled, len(flagged),
    )
    return {'backfilled': backfilled, 'flagged': len(flagged)}


@shared_task
def execute_destruction_certificate(certificate_id):
    """Carry out one approved destruction certificate (see ``destruction.execute_destruction``)."""
    from .destruction import execute_destruction

    outcome, detail = execute_destruction(certificate_id)
    logger.info('Destruction %s: %s (%s)', certificate_id, outcome, detail)
    return outcome


@shared_task
def execute_approved_destructions():
    """Daily sweep: run any approved certificate that has not been carried out (queue was down, or it was blocked)."""
    from .models import DestructionCertificate

    ids = list(DestructionCertificate.objects.filter(status='approved').values_list('id', flat=True))
    return {str(pk): execute_destruction_certificate(str(pk)) for pk in ids}
