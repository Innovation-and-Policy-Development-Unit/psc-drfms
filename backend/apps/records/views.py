from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import hashlib

from .models import Record, RecordVersion, RecordSeries, DocumentPermission
from .serializers import (
    RecordListSerializer, RecordDetailSerializer, RecordCreateSerializer,
    RecordUpdateSerializer, RecordVersionSerializer, RecordVersionUploadSerializer,
    RecordSeriesSerializer, DocumentPermissionSerializer,
)
from apps.accounts.permissions import IsRecordsOfficerOrAbove, IsAdministrator


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
        qs = Record.objects.select_related('record_series', 'custodian', 'author').filter(destroyed_at__isnull=True)
        user = self.request.user
        from apps.accounts.models import UserRole
        if user.role == UserRole.READ_ONLY:
            qs = qs.filter(
                Q(classification_level__in=['unclassified', 'internal']) |
                Q(permissions__user=user, permissions__can_view=True)
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
