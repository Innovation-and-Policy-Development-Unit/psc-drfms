import logging
from datetime import timedelta

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings
from django.utils import timezone

from apps.audit.models import AuditAction, AuditLog

from . import schedule
from .models import BackupRun, BackupSettings, RunStatus
from .service import run_backup

logger = logging.getLogger(__name__)

HARD_LIMIT = int(settings.BACKUP_TIME_LIMIT_HOURS * 3600)
SOFT_LIMIT = HARD_LIMIT - 600
# A "running" row older than the hard limit (plus slack) can only be one whose worker died.
STALE_AFTER = timedelta(seconds=HARD_LIMIT + 3600)
ALERT_EVERY = timedelta(hours=24)


def _notify_admins(title, message, kind):
    from apps.accounts.models import User, UserRole
    from apps.notifications.utils import send_notification

    for uid in User.objects.filter(role=UserRole.ADMINISTRATOR, is_active=True).values_list('id', flat=True):
        try:
            send_notification(uid, title, message, notification_type=kind, related_url='/admin/backups')
        except Exception:
            logger.exception('Could not notify administrator %s', uid)


def reap_stale_runs():
    """Mark runs whose worker died as failed, so history never shows a backup running forever."""
    stale = BackupRun.objects.filter(status=RunStatus.RUNNING, started_at__lt=timezone.now() - STALE_AFTER)
    return stale.update(
        status=RunStatus.FAILED, finished_at=timezone.now(),
        error='Interrupted: the worker stopped before this backup finished.',
    )


def active_run():
    reap_stale_runs()
    return BackupRun.objects.filter(status=RunStatus.RUNNING).first()


def last_success():
    return BackupRun.objects.filter(status=RunStatus.SUCCESS).first()


def is_overdue(cfg, now):
    """Enabled, set up, and no successful backup for longer than one period plus a day's grace."""
    if not (cfg.enabled and cfg.configured):
        return False
    limit = schedule.period(cfg) + schedule.OVERDUE_GRACE
    ok = last_success()
    reference = ok.finished_at or ok.started_at if ok else cfg.updated_at
    return now - reference > limit


@shared_task(time_limit=HARD_LIMIT, soft_time_limit=SOFT_LIMIT)
def run_backup_task(run_id):
    run = BackupRun.objects.get(pk=run_id)
    cfg = BackupSettings.load()
    try:
        run_backup(run, cfg)
        run.status = RunStatus.SUCCESS
    except SoftTimeLimitExceeded:
        run.status = RunStatus.FAILED
        run.error = f'The backup ran longer than {settings.BACKUP_TIME_LIMIT_HOURS:g} hours and was stopped.'
    except Exception as exc:
        logger.exception('Backup failed')
        run.status = RunStatus.FAILED
        run.error = str(exc)[:2000]
    run.finished_at = timezone.now()
    run.save()

    AuditLog.objects.create(
        user=run.triggered_by, action=AuditAction.EXPORT,
        extra={'backup': {
            'run': str(run.id), 'status': run.status, 'trigger': run.trigger,
            'database': run.database_file, 'files_copied': run.files_copied, 'error': run.error,
        }},
    )
    if run.status == RunStatus.FAILED:
        _notify_admins('Backup failed', run.error or 'The backup did not complete.', 'error')
    return run.status


def is_due(cfg, now):
    """True when a scheduled slot has passed (even if the scheduler was down) with no scheduled run since."""
    if not (cfg.enabled and cfg.configured):
        return False
    slot = schedule.latest_slot(cfg, now)
    if slot is None or slot <= cfg.updated_at:  # settings changed after the slot: wait for the next one
        return False
    if BackupRun.objects.filter(trigger='scheduled', started_at__gte=slot).exists():
        return False
    return active_run() is None


@shared_task
def run_scheduled_backup():
    """Runs hourly: starts a backup that is due, and warns administrators when backups have stopped working."""
    cfg = BackupSettings.load()
    now = timezone.localtime()

    if is_overdue(cfg, now) and (cfg.last_alert_at is None or now - cfg.last_alert_at > ALERT_EVERY):
        _notify_admins('Backups are overdue', 'No backup has completed successfully within the expected time. '
                       'Check the Backup page.', 'warning')
        cfg.last_alert_at = now
        cfg.save(update_fields=['last_alert_at'])

    if not is_due(cfg, now):
        return 'skipped'
    run = BackupRun.objects.create(trigger='scheduled')
    run_backup_task.delay(str(run.id))
    return 'started'
