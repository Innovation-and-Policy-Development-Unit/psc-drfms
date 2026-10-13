from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from . import schedule, smb
from .models import BackupRun, BackupSettings
from .serializers import BackupRunSerializer, BackupSettingsSerializer, ConnectionSerializer
from .tasks import active_run, is_overdue, last_success, run_backup_task

ADMIN_ONLY = [permissions.IsAuthenticated, IsAdministrator]


def _payload(cfg):
    now = timezone.localtime()
    last = BackupRun.objects.exclude(status='running').first()
    ok = last_success()
    return {
        **BackupSettingsSerializer(cfg).data,
        'configured': cfg.configured,
        'credentials_unreadable': cfg.credentials_unreadable,
        'next_run': schedule.next_slot(cfg, now) if cfg.enabled and cfg.configured else None,
        'last_run': BackupRunSerializer(last).data if last else None,
        'last_success_at': (ok.finished_at or ok.started_at) if ok else None,
        'overdue': is_overdue(cfg, now),
        'running': active_run() is not None,
        'timezone': timezone.get_current_timezone_name(),
    }


class BackupSettingsView(APIView):
    permission_classes = ADMIN_ONLY

    def get(self, request):
        return Response(_payload(BackupSettings.load()))

    def put(self, request):
        cfg = BackupSettings.load()
        ser = BackupSettingsSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        changed = sorted(k for k in ser.validated_data if k not in ('password', 'passphrase'))
        changed += [k for k in ('password', 'passphrase') if ser.validated_data.get(k)]
        cfg = ser.save(updated_by=request.user)
        log_action(request, AuditAction.UPDATE, extra={'backup_settings': changed})
        return Response(_payload(cfg))


class BackupTestView(APIView):
    """Try the connection with the form's current values, without saving them."""
    permission_classes = ADMIN_ONLY

    def post(self, request):
        saved = BackupSettings.load()
        ser = ConnectionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        fields = ('server', 'share', 'folder', 'domain', 'username')
        cfg = BackupSettings(**{f: ser.validated_data.get(f, getattr(saved, f)) for f in fields})
        password = request.data.get('password') or saved.password
        if not (cfg.server and cfg.share and cfg.username and password):
            return Response({'ok': False, 'message': 'Enter the server, share, username and password first.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            where = smb.test(cfg, password)
        except smb.ShareError as exc:
            return Response({'ok': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'ok': True, 'message': f'Connected. DRFMS can write to {where}.'})


class BackupRunView(APIView):
    permission_classes = ADMIN_ONLY

    def get(self, request):
        active_run()  # settles any run orphaned by a stopped worker before listing
        return Response(BackupRunSerializer(BackupRun.objects.all()[:30], many=True).data)

    def post(self, request):
        with transaction.atomic():
            # Lock the single settings row so two simultaneous clicks cannot both start a run.
            cfg = BackupSettings.objects.select_for_update().get(pk=BackupSettings.load().pk)
            if not cfg.configured:
                return Response({'detail': 'Save the share connection before running a backup.'},
                                status=status.HTTP_400_BAD_REQUEST)
            if active_run():
                return Response({'detail': 'A backup is already running.'}, status=status.HTTP_409_CONFLICT)
            run = BackupRun.objects.create(trigger='manual', triggered_by=request.user)
            transaction.on_commit(lambda: run_backup_task.delay(str(run.id)))
        return Response(BackupRunSerializer(run).data, status=status.HTTP_202_ACCEPTED)
