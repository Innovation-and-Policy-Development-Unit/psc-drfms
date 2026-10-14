"""Endpoints behind the file browser: thumbnails, storage meter, pinned views, blank documents."""
import hashlib
import re

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db.models import Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsRecordsOfficerOrAbove

from . import thumbnails
from .authorization import ensure_record_access, viewable_records
from .blank_docs import KINDS, build_blank
from apps.accounts.models import UserRole
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .models import PinnedView, Record, RecordSeries, RecordVersion

MAX_PINS = 25
MAX_FOLDER_DEPTH = 6
STORAGE_CACHE_SECONDS = 60


class RecordThumbnailView(APIView):
    """First-page JPEG of the latest version; 204 when this file type has none."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'view')
        version = record.versions.order_by('-version_number').first()
        data = thumbnails.thumbnail_bytes(version) if version else None
        if data is None:
            return HttpResponse(status=status.HTTP_204_NO_CONTENT)
        response = HttpResponse(data, content_type='image/jpeg')
        response['Cache-Control'] = 'private, max-age=3600'
        return response


class StorageUsageView(APIView):
    """How much file storage the records this user can see occupy, against an optional quota."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        key = f'storage_usage:{request.user.pk}'
        data = cache.get(key)
        if data is None:
            visible = viewable_records(request.user).values('pk')
            total = RecordVersion.objects.filter(record_id__in=visible).aggregate(n=Sum('file_size'))['n'] or 0
            quota = settings.STORAGE_QUOTA_GB * 1024 ** 3
            data = {'used_bytes': total, 'quota_bytes': quota or None, 'record_count': viewable_records(request.user).count()}
            cache.set(key, data, STORAGE_CACHE_SECONDS)
        return Response(data)


_SAFE_TARGET = re.compile(r'^/[A-Za-z0-9_\-./?=&%+,:~@]*$')


def _clean_target(target):
    """An in-app path (with optional query) only: never an external URL or an auth page."""
    if not isinstance(target, str) or len(target) > 300:
        return None
    if target.startswith('//') or not _SAFE_TARGET.match(target) or target.startswith('/auth/'):
        return None
    return target


def _pin_json(p):
    return {'id': p.pk, 'label': p.label, 'target': p.target}


class PinListCreateView(APIView):
    """The user's Quick access shortcuts: saved views of the file browser."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response([_pin_json(p) for p in PinnedView.objects.filter(user=request.user)])

    def post(self, request):
        target = _clean_target(request.data.get('target'))
        label = ' '.join(str(request.data.get('label') or '').split())[:80]
        if not target or not label:
            return Response({'detail': 'A label and an in-app link are required.'}, status=status.HTTP_400_BAD_REQUEST)
        mine = PinnedView.objects.filter(user=request.user)
        existing = mine.filter(target=target).first()
        if existing:
            return Response(_pin_json(existing))
        if mine.count() >= MAX_PINS:
            return Response({'detail': f'You can pin at most {MAX_PINS} items. Remove one first.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(_pin_json(PinnedView.objects.create(user=request.user, label=label, target=target)), status=status.HTTP_201_CREATED)


class PinDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        get_object_or_404(PinnedView, pk=pk, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _folder_code(parent, name):
    """Unique series code: parent code + initials of the name (e.g. HR-01 + 'Leave files' -> HR-01-LF)."""
    initials = ''.join(w[0] for w in re.findall(r'[A-Za-z0-9]+', name))[:6].upper() or 'F'
    base = f'{parent.code}-{initials}' if parent else initials
    base = base[:26]
    code, n = base, 1
    while RecordSeries.objects.filter(code=code).exists():
        n += 1
        code = f'{base}-{n}'
    return code


class NewFolderView(APIView):
    """Create a folder (a record series).

    Records officers may add a folder inside an existing series; it inherits that series' retention
    period, so nobody can shorten retention by creating folders. Top-level folders, and choosing a
    retention period, are for administrators because the series tree carries the retention rules.
    """
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request):
        name = ' '.join(str(request.data.get('name') or '').split())[:255]
        if not name:
            return Response({'detail': 'Give the folder a name.'}, status=status.HTTP_400_BAD_REQUEST)
        is_admin = request.user.role == UserRole.ADMINISTRATOR

        parent = None
        if request.data.get('parent'):
            parent = get_object_or_404(RecordSeries, pk=request.data['parent'], is_active=True)
            depth, node = 1, parent
            while node.parent_id:
                node, depth = node.parent, depth + 1
            if depth >= MAX_FOLDER_DEPTH:
                return Response({'detail': f'Folders can be nested at most {MAX_FOLDER_DEPTH} levels deep.'}, status=status.HTTP_400_BAD_REQUEST)
        elif not is_admin:
            return Response({'detail': 'Only an administrator can create a top-level folder. Create it inside an existing one.'}, status=status.HTTP_403_FORBIDDEN)

        if RecordSeries.objects.filter(parent=parent, name__iexact=name, is_active=True).exists():
            return Response({'detail': 'A folder with that name already exists here.'}, status=status.HTTP_400_BAD_REQUEST)

        years = parent.retention_years if parent else 7
        if is_admin and request.data.get('retention_years') not in (None, ''):
            try:
                years = int(request.data['retention_years'])
            except (TypeError, ValueError):
                return Response({'detail': 'Retention must be a whole number of years.'}, status=status.HTTP_400_BAD_REQUEST)
            if not 0 <= years <= 150:
                return Response({'detail': 'Retention must be between 0 and 150 years.'}, status=status.HTTP_400_BAD_REQUEST)

        series = RecordSeries.objects.create(code=_folder_code(parent, name), name=name, parent=parent, retention_years=years)
        log_action(request, AuditAction.CREATE, extra={'folder': series.code, 'name': series.name, 'parent': parent.code if parent else None})
        return Response(
            {'id': series.pk, 'code': series.code, 'name': series.name, 'parent': series.parent_id, 'retention_years': series.retention_years},
            status=status.HTTP_201_CREATED,
        )


class NewDocumentView(APIView):
    """Create an empty Word, Excel or PowerPoint document and return the record to open in the editor."""
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request):
        kind = request.data.get('kind')
        if kind not in KINDS:
            return Response({'detail': 'kind must be word, excel or powerpoint.'}, status=status.HTTP_400_BAD_REQUEST)
        title = ' '.join(str(request.data.get('title') or '').split())[:200] or {
            'word': 'Untitled document', 'excel': 'Untitled workbook', 'powerpoint': 'Untitled presentation',
        }[kind]
        series = None
        if request.data.get('record_series'):
            series = get_object_or_404(RecordSeries, pk=request.data['record_series'], is_active=True)

        content, ext, mime = build_blank(kind)
        record = Record.objects.create(
            title=title, record_series=series, custodian=request.user, author=request.user,
        )
        file_name = f'{re.sub(r"[^A-Za-z0-9 _.-]", "", title).strip() or "document"}.{ext}'
        RecordVersion.objects.create(
            record=record, version_number=1, file=ContentFile(content, name=file_name),
            file_name=file_name, file_size=len(content), mime_type=mime,
            content_hash=hashlib.sha256(content).hexdigest(),
            change_summary='Created blank document', created_by=request.user,
        )
        return Response({'id': str(record.pk), 'reference_number': record.reference_number}, status=status.HTTP_201_CREATED)
