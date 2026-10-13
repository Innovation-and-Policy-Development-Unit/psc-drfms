import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.audit.models import AuditAction, AuditLog

from .models import BackupRun, BackupSettings, Frequency, RunStatus
from .service import run_backup

logger = logging.getLogger(__name__)

STALE_AFTER = timedelta(hours=3)


def _notify_admins(title, message, kind):
    from apps.accounts.models import User, UserRole
    from apps.notifications.utils import send_notification

    for uid in User.objects.filter(role=UserRole.ADMINISTRATOR, is_active=True).values_list('id', flat=True):
        try:
            send_notification(uid, title, message, notification_type=kind, related_url='/admin/backups')
        except Exception:
            logger.exception('Could not notify administrator %s', uid)


def active_run():
    """A run that is genuinely still going (not one orphaned by a crash)."""
    return BackupRun.objects.filter(
        status=RunStatus.RUNNING, started_at__gte=timezone.now() - STALE_AFTER,
    ).first()


@shared_task
def run_backup_task(run_id):
    run = BackupRun.objects.get(pk=run_id)
    cfg = BackupSettings.load()
    try:
        run_backup(run, cfg)
        run.status = RunStatus.SUCCESS
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
    if not (cfg.enabled and cfg.configured) or now.hour != cfg.run_hour:
        return False
    if cfg.frequency == Frequency.WEEKLY and now.weekday() != cfg.weekday:
        return False
    recent = BackupRun.objects.filter(started_at__gte=now - timedelta(hours=20), trigger='scheduled')
    return not recent.exists() and active_run() is None


@shared_task
def run_scheduled_backup():
    """Runs hourly; starts a backup only when the administrator's schedule says it is time."""
    cfg = BackupSettings.load()
    if not is_due(cfg, timezone.localtime()):
        return 'skipped'
    run = BackupRun.objects.create(trigger='scheduled')
    run_backup_task.delay(str(run.id))
    return 'started'
