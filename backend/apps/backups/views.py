from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from . import smb
from .models import BackupRun, BackupSettings, Frequency
from .serializers import BackupRunSerializer, BackupSettingsSerializer
from .tasks import active_run, run_backup_task

ADMIN_ONLY = [permissions.IsAuthenticated, IsAdministrator]


def next_run_at(cfg):
    if not (cfg.enabled and cfg.configured):
        return None
    now = timezone.localtime()
    for days in range(0, 8):
        cand = (now + timedelta(days=days)).replace(hour=cfg.run_hour, minute=0, second=0, microsecond=0)
        if cand <= now:
            continue
        if cfg.frequency == Frequency.WEEKLY and cand.weekday() != cfg.weekday:
            continue
        return cand
    return None


def _payload(cfg):
    last = BackupRun.objects.exclude(status='running').first()
    return {
        **BackupSettingsSerializer(cfg).data,
        'configured': cfg.configured,
        'next_run': next_run_at(cfg),
        'last_run': BackupRunSerializer(last).data if last else None,
        'running': active_run() is not None,
    }


class BackupSettingsView(APIView):
    permission_classes = ADMIN_ONLY

    def get(self, request):
        return Response(_payload(BackupSettings.load()))

    def put(self, request):
        cfg = BackupSettings.load()
        ser = BackupSettingsSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        changed = sorted(k for k in ser.validated_data if k != 'password')
        if ser.validated_data.get('password'):
            changed.append('password')
        cfg = ser.save(updated_by=request.user)
        log_action(request, AuditAction.UPDATE, extra={'backup_settings': changed})
        return Response(_payload(cfg))


class BackupTestView(APIView):
    """Try the connection with the form's current values, without saving them."""
    permission_classes = ADMIN_ONLY

    def post(self, request):
        saved = BackupSettings.load()
        data = request.data
        cfg = BackupSettings(**{f: str(data.get(f, getattr(saved, f)) or '').strip()
                                for f in ('server', 'share', 'folder', 'domain', 'username')})
        password = data.get('password') or saved.password
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
        return Response(BackupRunSerializer(BackupRun.objects.all()[:30], many=True).data)

    def post(self, request):
        cfg = BackupSettings.load()
        if not cfg.configured:
            return Response({'detail': 'Save the share connection before running a backup.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if active_run():
            return Response({'detail': 'A backup is already running.'}, status=status.HTTP_409_CONFLICT)
        run = BackupRun.objects.create(trigger='manual', triggered_by=request.user)
        run_backup_task.delay(str(run.id))
        return Response(BackupRunSerializer(run).data, status=status.HTTP_202_ACCEPTED)
