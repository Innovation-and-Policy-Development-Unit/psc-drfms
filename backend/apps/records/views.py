from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, OuterRef, Subquery
from django.http import FileResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import hashlib

from .models import Record, RecordVersion, RecordSeries, DocumentPermission, RecordStar
from .serializers import (
    RecordListSerializer, RecordDetailSerializer, RecordCreateSerializer,
    RecordUpdateSerializer, RecordVersionSerializer, RecordVersionUploadSerializer,
    RecordSeriesSerializer, DocumentPermissionSerializer,
)
from apps.accounts.permissions import IsRecordsOfficerOrAbove, IsAdministrator
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer


class RecordListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['document_type', 'classification_level', 'record_series', 'is_vital', 'is_on_legal_hold', 'is_draft', 'custodian']
    search_fields = ['title', 'reference_number', 'description', 'originating_ministry']
    ordering_fields = ['created_at', 'updated_at', 'document_date', 'title']
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
                version_count=Count('versions'),
                file_name=Subquery(latest_version.values('file_name')[:1]),
                mime_type=Subquery(latest_version.values('mime_type')[:1]),
                file_size=Subquery(latest_version.values('file_size')[:1]),
                _user_starred=Count('stars', filter=Q(stars__user=user)),
            )
        )
        from apps.accounts.models import UserRole
        if user.role == UserRole.READ_ONLY:
            qs = qs.filter(
                Q(classification_level__in=['unclassified', 'internal']) |
                Q(permissions__user=user, permissions__can_view=True)
            ).distinct()

        if self.request.query_params.get('starred') == 'true':
            qs = qs.filter(stars__user=user)

        if self.request.query_params.get('shared_with_me') == 'true':
            from apps.sharing.models import SharedLink
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


class RecordDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return RecordUpdateSerializer
        return RecordDetailSerializer

    def get_queryset(self):
        return Record.objects.select_related('record_series', 'custodian', 'author', 'record_series').prefetch_related('versions', 'related_records', 'permissions')

    def get_object(self):
        record = super().get_object()
        from apps.audit.utils import log_action
        log_action(self.request, 'view', record)
        return record

    def destroy(self, request, *args, **kwargs):
        record = self.get_object()
        if record.is_on_legal_hold:
            return Response({'detail': 'Cannot delete a record under legal hold.'}, status=403)
        if record.is_vital:
            return Response({'detail': 'Cannot delete a vital record.'}, status=403)
        record.destroyed_at = __import__('django.utils.timezone', fromlist=['timezone']).timezone.now()
        record.save(update_fields=['destroyed_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecordStarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
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
        return RecordVersion.objects.filter(record_id=self.kwargs['pk']).select_related('created_by')


class RecordVersionUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        record = get_object_or_404(Record, pk=pk)
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

        from .tasks import process_record_ocr, check_duplicate_on_upload
        process_record_ocr.delay(str(version.id))
        check_duplicate_on_upload.delay(str(version.id))

        from apps.audit.utils import log_action
        log_action(request, 'upload_version', record, extra={'version_number': next_version})

        return Response(RecordVersionSerializer(version).data, status=201)


class RecordVersionDiffView(APIView):
    """Side-by-side diff view of two versions."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        v1_id = request.query_params.get('v1')
        v2_id = request.query_params.get('v2')
        if not v1_id or not v2_id:
            return Response({'detail': 'Provide v1 and v2 version IDs.'}, status=400)

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


class RecordQRCodeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        record = get_object_or_404(Record, pk=pk)
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
        return DocumentPermission.objects.filter(record_id=self.kwargs['pk'])

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user, record_id=self.kwargs['pk'])


class DocumentPermissionDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def delete(self, request, pk, perm_id):
        perm = get_object_or_404(DocumentPermission, id=perm_id, record_id=pk)
        perm.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RecordAuditLogView(generics.ListAPIView):
    """Audit history for a single record (any user who can open the record)."""
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AuditLog.objects.filter(
            record_id=self.kwargs['pk']
        ).select_related('user').order_by('-timestamp')[:100]


class RecordBulkUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request):
        ids = request.data.get('record_ids', [])
        if not ids:
            return Response({'detail': 'record_ids required.'}, status=400)

        qs = Record.objects.filter(id__in=ids, destroyed_at__isnull=True)
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
