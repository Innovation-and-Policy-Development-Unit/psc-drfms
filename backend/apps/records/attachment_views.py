"""Extra files on a record (annexes, enclosures, a PDF copy) that are not versions of the main file.

Nothing is erased: removing an attachment hides it, and an editor can bring it back.
"""
import hashlib
import mimetypes

from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .authorization import can_edit, ensure_record_access
from .models import Record, RecordAttachment
from .serializers import ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES

MAX_ATTACHMENTS = 100


def attachment_json(a):
    return {
        'id': a.pk, 'file_name': a.file_name, 'file_size': a.file_size, 'mime_type': a.mime_type,
        'role': a.role, 'description': a.description, 'created_at': a.created_at,
        'uploaded_by_name': a.uploaded_by.get_full_name() if a.uploaded_by else '',
        'removed': a.removed_at is not None,
    }


def store_attachment(record, user, file, role=RecordAttachment.ANNEX, description=''):
    """Validate and save one uploaded file as an attachment. Raises ValueError with a user-facing message."""
    if file.size > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError(f'{file.name} is larger than the {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB limit.')
    mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
    if mime not in ALLOWED_MIME_TYPES:
        raise ValueError(f'File type "{mime}" is not permitted.')
    if record.attachments.filter(removed_at__isnull=True).count() >= MAX_ATTACHMENTS:
        raise ValueError(f'A record can have at most {MAX_ATTACHMENTS} attachments.')
    content = file.read()
    file.seek(0)
    return RecordAttachment.objects.create(
        record=record, file=file, file_name=file.name[:500], file_size=file.size, mime_type=mime,
        content_hash=hashlib.sha256(content).hexdigest(), role=role,
        description=' '.join(description.split())[:300], uploaded_by=user,
    )


class AttachmentListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, pk):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'view')
        qs = record.attachments.select_related('uploaded_by')
        if not (request.query_params.get('include_removed') and can_edit(request.user, record)):
            qs = qs.filter(removed_at__isnull=True)
        return Response({'results': [attachment_json(a) for a in qs]})

    def post(self, request, pk):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'edit')
        files = request.FILES.getlist('file')
        if not files:
            return Response({'detail': 'Choose at least one file.'}, status=status.HTTP_400_BAD_REQUEST)
        created = []
        try:
            for f in files:
                created.append(store_attachment(record, request.user, f, description=request.data.get('description', '')))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        log_action(request, AuditAction.UPLOAD_VERSION, record, extra={'attachments': [a.file_name for a in created]})
        return Response({'results': [attachment_json(a) for a in created]}, status=status.HTTP_201_CREATED)


class AttachmentRemoveRestoreView(APIView):
    """POST .../remove/ hides the file; POST .../restore/ brings it back."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, attachment_id, action):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'edit')
        att = get_object_or_404(RecordAttachment, pk=attachment_id, record=record)
        if action == 'remove':
            att.removed_at, att.removed_by = timezone.now(), request.user
        else:
            att.removed_at, att.removed_by = None, None
        att.save(update_fields=['removed_at', 'removed_by'])
        log_action(request, AuditAction.UPDATE, record, extra={'attachment_' + action: att.file_name})
        return Response(attachment_json(att))


class AttachmentDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, attachment_id):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'download')
        att = get_object_or_404(RecordAttachment, pk=attachment_id, record=record, removed_at__isnull=True)
        log_action(request, AuditAction.DOWNLOAD, record, extra={'attachment': att.file_name})
        inline = request.query_params.get('inline') in ('1', 'true', 'yes')
        response = FileResponse(att.file.open('rb'), content_type=att.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'{"inline" if inline else "attachment"}; filename="{att.file_name}"'
        return response
