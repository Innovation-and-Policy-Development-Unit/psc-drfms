from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, OuterRef, Subquery, Exists, Case, When, IntegerField, Value
from django.db.models.functions import Left
from django.http import FileResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import hashlib

from .models import Record, RecordVersion, RecordSeries, DocumentPermission, RecordStar
from .authorization import CLASSIFICATION_RANK, ensure_record_access, visible_records_q
from apps.sharing.models import SharedLink
from .tasks import process_record_ocr, check_duplicate_on_upload
from .serializers import (
    RecordListSerializer, RecordDetailSerializer, RecordCreateSerializer,
    RecordUpdateSerializer, RecordVersionSerializer, RecordVersionUploadSerializer,
    RecordSeriesSerializer, DocumentPermissionSerializer,
)
from apps.accounts.permissions import IsRecordsOfficerOrAbove, IsAdministrator
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer


# ?file_type= quick filters, matched on the latest version's mime type
FILE_TYPE_FILTERS = {
    'pdf': Q(mime_type__icontains='pdf'),
    'word': Q(mime_type__icontains='wordprocessingml') | Q(mime_type__icontains='msword') | Q(mime_type__icontains='opendocument.text'),
    'excel': Q(mime_type__icontains='spreadsheetml') | Q(mime_type__icontains='ms-excel') | Q(mime_type__icontains='opendocument.spreadsheet') | Q(mime_type__icontains='csv'),
    'powerpoint': Q(mime_type__icontains='presentationml') | Q(mime_type__icontains='ms-powerpoint') | Q(mime_type__icontains='opendocument.presentation'),
    'image': Q(mime_type__istartswith='image/'),
}


class RecordListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['document_type', 'classification_level', 'record_series', 'is_vital', 'is_on_legal_hold', 'is_draft', 'custodian', 'originating_ministry']
    search_fields = ['title', 'reference_number', 'description', 'originating_ministry']
    ordering_fields = [
        'created_at', 'updated_at', 'document_date', 'title', 'reference_number', 'document_type',
        'retention_date', 'file_size', 'classification_rank', 'record_series__name', 'originating_ministry',
    ]
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RecordCreateSerializer
        return RecordListSerializer

    def get_queryset(self):
        user = self.request.user
        latest_version = RecordVersion.objects.filter(
            record=OuterRef('pk')
        ).order_by('-version_number')
        qs = (
            Record.objects
            .select_related('record_series', 'custodian', 'author')
            .filter(destroyed_at__isnull=True)
            .annotate(
                version_count=Count('versions', distinct=True),
                file_name=Subquery(latest_version.values('file_name')[:1]),
                mime_type=Subquery(latest_version.values('mime_type')[:1]),
                file_size=Subquery(latest_version.values('file_size')[:1]),
                _user_starred=Count('stars', filter=Q(stars__user=user), distinct=True),
                _attachment_count=Count('attachments', filter=Q(attachments__removed_at__isnull=True), distinct=True),
                _summary_preview=Left(Subquery(latest_version.values('ai_summary')[:1]), 160),
                _is_shared=Exists(SharedLink.objects.filter(record=OuterRef('pk'), is_active=True))
                | Exists(DocumentPermission.objects.filter(record=OuterRef('pk'))),
                classification_rank=Case(
                    *[When(classification_level=level, then=Value(rank)) for level, rank in CLASSIFICATION_RANK.items()],
                    default=Value(99), output_field=IntegerField(),
                ),
            )
        )
        qs = qs.filter(visible_records_q(user)).distinct()

        year = self.request.query_params.get('year')
        if year and year.isdigit():
            qs = qs.filter(document_date__year=int(year))

        file_type = FILE_TYPE_FILTERS.get(self.request.query_params.get('file_type', ''))
        if file_type:
            qs = qs.filter(file_type)

        if self.request.query_params.get('starred') == 'true':
            qs = qs.filter(stars__user=user)

        tag = self.request.query_params.get('tag')
        if tag:
            qs = qs.filter(tags__contains=[tag])

        if self.request.query_params.get('shared_with_me') == 'true':
            email = (user.email or '').strip()
            shared_q = Q(permissions__user=user, permissions__can_view=True)
            if email:
                shared_q |= Q(
                    shared_links__recipient_email__iexact=email,
                    shared_links__is_active=True,
                )
            qs = qs.filter(shared_q).exclude(
                Q(custodian=user) | Q(author=user)
            ).distinct()

        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsRecordsOfficerOrAbove()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        record = serializer.save()
        from apps.audit.utils import log_action
        log_action(self.request, 'create', record)


class RecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return RecordUpdateSerializer
        return RecordDetailSerializer

    def get_queryset(self):
        return (
            Record.objects.filter(destroyed_at__isnull=True)
            .select_related('record_series', 'custodian', 'author', 'record_series')
            .prefetch_related('versions', 'related_records', 'permissions')
        )

    def get_object(self):
        record = super().get_object()
        ensure_record_access(self.request.user, record, 'view')
        if self.request.method in ('PUT', 'PATCH'):
            ensure_record_access(self.request.user, record, 'edit')
        from apps.audit.utils import log_action
        log_action(self.request, 'view', record)
        return record

    def perform_update(self, serializer):
        # Snapshot first: save() updates the instance in place
        before = {name: getattr(serializer.instance, name) for name in serializer.validated_data}
        record = serializer.save()
        changed = sorted(name for name, old in before.items() if getattr(record, name) != old)
        if changed:
            from apps.audit.utils import log_action
            # Field names only: values may be sensitive and the log is widely readable
            log_action(self.request, 'update', record, extra={'fields': changed})

    def destroy(self, request, *args, **kwargs):
        record = self.get_object()
        ensure_record_access(request.user, record, 'delete')
        if record.is_on_legal_hold:
            return Response({'detail': 'Cannot delete a record under legal hold.'}, status=403)
        if record.is_vital:
            return Response({'detail': 'Cannot delete a vital record.'}, status=403)
        # Into the Recycle bin, not erased: destroyed_at hides it from every list and search,
        # deleted_at / deleted_by let it be found and restored
        record.destroyed_at = record.deleted_at = timezone.now()
        record.deleted_by = request.user
        record.save(update_fields=['destroyed_at', 'deleted_at', 'deleted_by'])
        from apps.audit.utils import log_action
        log_action(request, 'delete', record, extra={'recycle_bin': True})
        return Response(status=status.HTTP_204_NO_CONTENT)


class TagListView(APIView):
    """Every tag on records the viewer may see, with how many records carry it."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db import connection
        from .authorization import viewable_records

        visible_sql, params = viewable_records(request.user).values("pk").query.sql_with_params()
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT t.tag, COUNT(*)
                FROM records_record r
                CROSS JOIN LATERAL jsonb_array_elements_text(
                    CASE WHEN jsonb_typeof(r.tags) = 'array' THEN r.tags ELSE '[]'::jsonb END
                ) AS t(tag)
                WHERE r.id IN ({visible_sql})
                GROUP BY t.tag
                ORDER BY COUNT(*) DESC, t.tag
                LIMIT 200
                """,
                params,
            )
            rows = cursor.fetchall()
        return Response([{"tag": tag, "count": count} for tag, count in rows])


class RecordStarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'view')
        RecordStar.objects.get_or_create(user=request.user, record_id=pk)
        return Response({'starred': True})

    def delete(self, request, pk):
        RecordStar.objects.filter(user=request.user, record_id=pk).delete()
        return Response({'starred': False})


class RecordVersionPreviewUrlView(APIView):
    """Presigned object URL for Office Online / external preview (when storage supports it)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, version_id):
        version = get_object_or_404(
            RecordVersion.objects.select_related('record'),
            id=version_id,
            record_id=pk,
        )
        ensure_record_access(request.user, version.record, 'download')
        presigned_url = None
        try:
            from django.core.files.storage import default_storage
            if hasattr(default_storage, 'url'):
                presigned_url = default_storage.url(version.file.name, expire=3600)
        except Exception:
            presigned_url = None

        download_url = request.build_absolute_uri(
            f'/api/records/{pk}/versions/{version_id}/download/?inline=1'
        )
        office_embed_url = None
        mime = (version.mime_type or '').lower()
        name = (version.file_name or '').lower()
        is_office = (
            'word' in mime or 'sheet' in mime or 'excel' in mime
            or name.endswith(('.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'))
        )
        if presigned_url and is_office:
            from urllib.parse import quote
            office_embed_url = (
                'https://view.officeapps.live.com/op/embed.aspx?src='
                + quote(presigned_url, safe='')
            )

        return Response({
            'presigned_url': presigned_url,
            'download_url': download_url,
            'office_embed_url': office_embed_url,
            'mime_type': version.mime_type,
            'file_name': version.file_name,
            'use_office_viewer': bool(office_embed_url),
        })


class RecordVersionDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, version_id):
        version = get_object_or_404(
            RecordVersion.objects.select_related('record'),
            id=version_id,
            record_id=pk,
        )
        ensure_record_access(request.user, version.record, 'download')
        from apps.audit.utils import log_action
        log_action(request, 'download', version.record, extra={'version_number': version.version_number})

        inline = request.query_params.get('inline') in ('1', 'true', 'yes')
        disposition = 'inline' if inline else 'attachment'
        response = FileResponse(
            version.file.open('rb'),
            content_type=version.mime_type or 'application/octet-stream',
        )
        response['Content-Disposition'] = f'{disposition}; filename="{version.file_name}"'
        return response


class RecordVersionListView(generics.ListAPIView):
    serializer_class = RecordVersionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        record = get_object_or_404(Record, pk=self.kwargs['pk'])
        ensure_record_access(self.request.user, record, 'view')
        return RecordVersion.objects.filter(record_id=self.kwargs['pk']).select_related('created_by')


class RecordVersionUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        record = get_object_or_404(Record, pk=pk)
        ensure_record_access(request.user, record, 'edit')
        if record.is_on_legal_hold:
            return Response({'detail': 'Record is under legal hold.'}, status=403)
        serializer = RecordVersionUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data['file']
        content = file.read()
        content_hash = hashlib.sha256(content).hexdigest()
        file.seek(0)

        next_version = (record.versions.aggregate(m=__import__('django.db.models', fromlist=['Max']).Max('version_number'))['m'] or 0) + 1
        import mimetypes
        version = RecordVersion.objects.create(
            record=record,
            version_number=next_version,
            file=file,
            file_name=file.name,
            file_size=file.size,
            mime_type=file.content_type or mimetypes.guess_type(file.name)[0] or 'application/octet-stream',
            content_hash=content_hash,
            change_summary=serializer.validated_data['change_summary'],
            created_by=request.user,
        )

        process_record_ocr.delay(str(version.id))
        check_duplicate_on_upload.delay(str(version.id))

        from apps.audit.utils import log_action
        log_action(request, 'upload_version', record, extra={'version_number': next_version})

        return Response(RecordVersionSerializer(version).data, status=201)


class RecordVersionVerifyView(APIView):
    """Re-hash the stored file and compare against the hash recorded at upload."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, version_id):
        version = get_object_or_404(
            RecordVersion.objects.select_related('record'),
            id=version_id,
            record_id=pk,
        )
        ensure_record_access(request.user, version.record, 'view')

        try:
            with version.file.open('rb') as f:
                hasher = hashlib.sha256()
                for chunk in iter(lambda: f.read(1024 * 1024), b''):
                    hasher.update(chunk)
            computed_hash = hasher.hexdigest()
            file_readable = True
        except Exception:
            computed_hash = None
            file_readable = False

        match = file_readable and computed_hash == version.content_hash

        from django.utils import timezone
        from apps.audit.utils import log_action
        log_action(request, 'view', version.record, extra={
            'event': 'integrity_verification',
            'version_number': version.version_number,
            'match': match,
            'stored_hash': version.content_hash,
            'computed_hash': computed_hash,
        })

        return Response({
            'version_number': version.version_number,
            'file_name': version.file_name,
            'match': match,
            'file_readable': file_readable,
            'stored_hash': version.content_hash,
            'computed_hash': computed_hash,
            'verified_at': timezone.now(),
        })


class RecordVersionDiffView(APIView):
    """Side-by-side diff view of two versions."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        v1_id = request.query_params.get('v1')
        v2_id = request.query_params.get('v2')
        if not v1_id or not v2_id:
            return Response({'detail': 'Provide v1 and v2 version IDs.'}, status=400)

        record = get_object_or_404(Record, pk=pk)
        ensure_record_access(request.user, record, 'view')
        v1 = get_object_or_404(RecordVersion, id=v1_id, record_id=pk)
        v2 = get_object_or_404(RecordVersion, id=v2_id, record_id=pk)

        import difflib
        diff = list(difflib.unified_diff(
            (v1.ocr_text or '').splitlines(),
            (v2.ocr_text or '').splitlines(),
            fromfile=f"v{v1.version_number}",
            tofile=f"v{v2.version_number}",
            lineterm='',
        ))

        return Response({
            'v1': RecordVersionSerializer(v1).data,
            'v2': RecordVersionSerializer(v2).data,
            'diff': diff,
        })


class RecordLifecycleView(APIView):
    """Subway-map lifecycle summary: capture → review → approved → retention → disposition."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        record = get_object_or_404(
            Record.objects.select_related('record_series', 'destruction_certificate'),
            pk=pk,
        )
        ensure_record_access(request.user, record, 'view')
        from .lifecycle import build_lifecycle
        return Response(build_lifecycle(record))


class RecordQRCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        record = get_object_or_404(Record, pk=pk)
        ensure_record_access(request.user, record, 'view')
        from .tasks import generate_qr_code
        generate_qr_code.delay(str(pk))
        return Response({'detail': 'QR code generation queued.'})


class RecordSeriesListView(generics.ListCreateAPIView):
    queryset = RecordSeries.objects.all()
    serializer_class = RecordSeriesSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdministrator()]
        return [permissions.IsAuthenticated()]


class DocumentPermissionView(generics.ListCreateAPIView):
    serializer_class = DocumentPermissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def get_queryset(self):
        record = get_object_or_404(Record, pk=self.kwargs['pk'])
        ensure_record_access(self.request.user, record, 'edit')
        return DocumentPermission.objects.filter(record_id=self.kwargs['pk'])

    def perform_create(self, serializer):
        record = get_object_or_404(Record, pk=self.kwargs['pk'])
        ensure_record_access(self.request.user, record, 'edit')
        serializer.save(granted_by=self.request.user, record_id=self.kwargs['pk'])


class DocumentPermissionDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def delete(self, request, pk, perm_id):
        perm = get_object_or_404(DocumentPermission.objects.select_related('record'), id=perm_id, record_id=pk)
        ensure_record_access(request.user, perm.record, 'edit')
        perm.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecordAuditLogView(generics.ListAPIView):
    """Audit history for a single record (any user who can open the record)."""
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        record = get_object_or_404(Record, pk=self.kwargs['pk'])
        ensure_record_access(self.request.user, record, 'view')
        return AuditLog.objects.filter(
            record_id=self.kwargs['pk']
        ).select_related('user').order_by('-timestamp')[:100]


class RecordBulkUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request):
        ids = request.data.get('record_ids', [])
        if not ids:
            return Response({'detail': 'record_ids required.'}, status=400)

        qs = Record.objects.filter(id__in=ids, destroyed_at__isnull=True).filter(
            visible_records_q(request.user)
        ).distinct()
        updated = 0

        if 'record_series' in request.data:
            series_id = request.data['record_series']
            if series_id:
                get_object_or_404(RecordSeries, pk=series_id)
            updated = qs.update(record_series_id=series_id or None)

        if 'add_tags' in request.data:
            tags = request.data['add_tags']
            if isinstance(tags, list):
                for record in qs:
                    merged = list(set((record.tags or []) + tags))
                    record.tags = merged
                    record.save(update_fields=['tags'])
                updated = qs.count()

        if 'remove_tags' in request.data:
            tags = set(request.data['remove_tags'] or [])
            for record in qs:
                record.tags = [t for t in (record.tags or []) if t not in tags]
                record.save(update_fields=['tags'])
            updated = qs.count()

        return Response({'detail': f'Updated {updated} record(s).', 'count': updated})
