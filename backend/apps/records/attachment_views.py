"""Extra files on a record (annexes, enclosures, a PDF copy) that are not versions of the main file.

Nothing is erased: removing an attachment hides it, and an editor can bring it back. An attachment can
also be promoted to a record of its own, and an existing record can be folded in as an attachment.
"""
import hashlib
import mimetypes

from django.core.files.base import ContentFile
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsRecordsOfficerOrAbove
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from . import thumbnails
from .authorization import CLASSIFICATION_RANK, _clearance, can_edit, ensure_record_access, viewable_records
from .models import ClassificationLevel, Record, RecordAttachment, RecordRelation, RecordSeries, RecordVersion
from .serializers import ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES
from .tasks import process_attachment_text, process_record_ocr, refresh_record_index

MAX_ATTACHMENTS = 100


def text_status(a):
    """'indexed' (its text is searchable), 'pending' (still being read) or 'none' (nothing readable in it)."""
    if not a.ocr_processed:
        return 'pending'
    return 'indexed' if a.ocr_text.strip() else 'none'


def attachment_json(a):
    return {
        'id': a.pk, 'file_name': a.file_name, 'file_size': a.file_size, 'mime_type': a.mime_type,
        'role': a.role, 'description': a.description, 'created_at': a.created_at,
        'uploaded_by_name': a.uploaded_by.get_full_name() if a.uploaded_by else '',
        'removed': a.removed_at is not None, 'text_status': text_status(a),
    }


def _check_file(file):
    if file.size > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError(f'{file.name} is larger than the {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB limit.')
    mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
    if mime not in ALLOWED_MIME_TYPES:
        raise ValueError(f'File type "{mime}" is not permitted.')
    return mime


def _room_for(record, extra=1):
    if record.attachments.filter(removed_at__isnull=True).count() + extra > MAX_ATTACHMENTS:
        raise ValueError(f'A record can have at most {MAX_ATTACHMENTS} attachments.')


def store_attachment(record, user, file, role=RecordAttachment.ANNEX, description=''):
    """Validate and save one uploaded file as an attachment, and queue reading its text. Raises ValueError."""
    mime = _check_file(file)
    _room_for(record)
    content = file.read()
    file.seek(0)
    att = RecordAttachment.objects.create(
        record=record, file=file, file_name=file.name[:500], file_size=file.size, mime_type=mime,
        content_hash=hashlib.sha256(content).hexdigest(), role=role,
        description=' '.join(description.split())[:300], uploaded_by=user,
    )
    process_attachment_text.delay(att.pk)
    return att


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
    """POST .../remove/ hides the file; POST .../restore/ brings it back. Search follows."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, attachment_id, action):
        if action not in ('remove', 'restore'):
            return Response({'detail': 'Unknown action.'}, status=status.HTTP_404_NOT_FOUND)
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'edit')
        att = get_object_or_404(RecordAttachment, pk=attachment_id, record=record)
        if action == 'remove':
            att.removed_at, att.removed_by = timezone.now(), request.user
        else:
            att.removed_at, att.removed_by = None, None
        att.save(update_fields=['removed_at', 'removed_by'])
        refresh_record_index(record.pk)
        log_action(request, AuditAction.UPDATE, record, extra={'attachment_' + action: att.file_name})
        return Response(attachment_json(att))


class AttachmentDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, attachment_id):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'download')
        att = get_object_or_404(RecordAttachment, pk=attachment_id, record=record, removed_at__isnull=True)
        inline = request.query_params.get('inline') in ('1', 'true', 'yes')
        log_action(request, AuditAction.VIEW if inline else AuditAction.DOWNLOAD, record, extra={'attachment': att.file_name})
        response = FileResponse(att.file.open('rb'), content_type=att.mime_type or 'application/octet-stream')
        response['Content-Disposition'] = f'{"inline" if inline else "attachment"}; filename="{att.file_name}"'
        return response


class AttachmentThumbnailView(APIView):
    """First-page JPEG of a PDF or image attachment; 204 for anything else."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, attachment_id):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'view')
        att = get_object_or_404(RecordAttachment, pk=attachment_id, record=record, removed_at__isnull=True)
        data = thumbnails.thumbnail_bytes(att)
        if data is None:
            return HttpResponse(status=status.HTTP_204_NO_CONTENT)
        response = HttpResponse(data, content_type='image/jpeg')
        response['Cache-Control'] = 'private, max-age=3600'
        return response


def _stem(name):
    return name.rsplit('.', 1)[0] if '.' in name else name


class AttachmentPromoteView(APIView):
    """Turn an attachment into a record of its own (for an annex that needs its own classification or retention).

    The new record is linked back with an "annex of" relationship and the attachment is hidden from the original.
    """
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request, pk, attachment_id):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'edit')
        att = get_object_or_404(RecordAttachment, pk=attachment_id, record=record, removed_at__isnull=True)

        title = ' '.join(str(request.data.get('title') or '').split())[:500] or _stem(att.file_name)[:500]
        level = request.data.get('classification_level') or record.classification_level
        if level not in ClassificationLevel.values:
            return Response({'detail': 'Unknown classification.'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role != 'administrator' and CLASSIFICATION_RANK[level] > _clearance(request.user):
            return Response({'detail': 'You cannot create a record at that classification.'}, status=status.HTTP_400_BAD_REQUEST)
        series = record.record_series
        if request.data.get('record_series'):
            series = get_object_or_404(RecordSeries, pk=request.data['record_series'], is_active=True)

        with att.file.open('rb') as fh:
            content = fh.read()
        new = Record.objects.create(
            title=title, document_type=record.document_type, classification_level=level, record_series=series,
            originating_ministry=record.originating_ministry, document_date=record.document_date,
            custodian=request.user, author=request.user,
        )
        version = RecordVersion(
            record=new, version_number=1, file_name=att.file_name, file_size=len(content), mime_type=att.mime_type,
            content_hash=att.content_hash, change_summary=f'Made from an attachment of {record.reference_number}',
            created_by=request.user, ocr_text=att.ocr_text, ocr_processed=att.ocr_processed,
        )
        version.file.save(att.file_name, ContentFile(content), save=False)
        version.save()
        RecordRelation.objects.create(from_record=new, to_record=record, relation_type=RecordRelation.ANNEX_OF, created_by=request.user)
        att.removed_at, att.removed_by = timezone.now(), request.user
        att.save(update_fields=['removed_at', 'removed_by'])

        if not version.ocr_processed:
            process_record_ocr.delay(str(version.id))
        refresh_record_index(record.pk)
        log_action(request, AuditAction.CREATE, new, extra={'made_from_attachment_of': record.reference_number, 'file': att.file_name})
        log_action(request, AuditAction.UPDATE, record, extra={'attachment_promoted': att.file_name, 'new_record': new.reference_number})
        return Response({'id': str(new.pk), 'reference_number': new.reference_number}, status=status.HTTP_201_CREATED)


class AttachRecordView(APIView):
    """Fold an existing record into this one as attachments.

    Its file, and any attachments it had, are copied here; the record itself moves to the Recycle bin marked
    "attached to ..." (restorable). It needs the same rights as deleting it, and it may not carry a higher
    classification than this record, or folding it in would lower its protection.
    """
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request, pk):
        target = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, target, 'edit')
        source = get_object_or_404(viewable_records(request.user), pk=request.data.get('record'))
        if source.pk == target.pk:
            return Response({'detail': 'A record cannot be attached to itself.'}, status=status.HTTP_400_BAD_REQUEST)
        ensure_record_access(request.user, source, 'delete')
        if source.is_on_legal_hold or source.is_vital:
            why = 'under legal hold' if source.is_on_legal_hold else 'a vital record'
            return Response({'detail': f'{source.reference_number} is {why}, so it cannot be folded into another record.'}, status=status.HTTP_400_BAD_REQUEST)
        if CLASSIFICATION_RANK.get(source.classification_level, 99) > CLASSIFICATION_RANK.get(target.classification_level, 0):
            return Response({
                'detail': f'{source.reference_number} is classified {source.classification_level}, higher than this record ({target.classification_level}). '
                          'Raise this record\'s classification first, or link the two records instead.',
            }, status=status.HTTP_400_BAD_REQUEST)
        version = source.versions.order_by('-version_number').first()
        if version is None:
            return Response({'detail': f'{source.reference_number} has no file to attach.'}, status=status.HTTP_400_BAD_REQUEST)

        pieces = [(version.file, version.file_name, version.mime_type, version.content_hash, version.ocr_text, version.ocr_processed, RecordAttachment.ANNEX)]
        pieces += [(a.file, a.file_name, a.mime_type, a.content_hash, a.ocr_text, a.ocr_processed, a.role)
                   for a in source.attachments.filter(removed_at__isnull=True)]
        try:
            _room_for(target, len(pieces))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for file, name, mime, digest, text, processed, role in pieces:
            with file.open('rb') as fh:
                content = fh.read()
            att = RecordAttachment(
                record=target, file_name=name[:500], file_size=len(content), mime_type=mime, content_hash=digest, role=role,
                description=f'From {source.reference_number} {source.title}'[:300], uploaded_by=request.user,
                ocr_text=text or '', ocr_processed=bool(processed),
            )
            att.file.save(name, ContentFile(content), save=False)
            att.save()
            if not att.ocr_processed:
                process_attachment_text.delay(att.pk)
            created.append(att)

        now = timezone.now()
        source.destroyed_at = source.deleted_at = now
        source.deleted_by, source.merged_into = request.user, target
        source.save(update_fields=['destroyed_at', 'deleted_at', 'deleted_by', 'merged_into'])
        refresh_record_index(target.pk)
        log_action(request, AuditAction.UPDATE, target, extra={'attached_record': source.reference_number, 'files': [a.file_name for a in created]})
        log_action(request, AuditAction.DELETE, source, extra={'recycle_bin': True, 'attached_to': target.reference_number})
        return Response({'results': [attachment_json(a) for a in created], 'attached': source.reference_number}, status=status.HTTP_201_CREATED)
