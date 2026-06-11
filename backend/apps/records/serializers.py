from rest_framework import serializers
from .models import Record, RecordVersion, RecordSeries, DocumentPermission, ClassificationLevel, DocumentType


class RecordSeriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecordSeries
        fields = ['id', 'code', 'name', 'description', 'parent', 'retention_years', 'is_active']


class RecordVersionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    file_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()

    class Meta:
        model = RecordVersion
        fields = [
            'id', 'version_number', 'file_name', 'file_size', 'mime_type',
            'content_hash', 'ocr_text', 'ocr_processed', 'ai_suggestions',
            'is_signed', 'signature_info', 'change_summary',
            'created_by', 'created_by_name', 'created_at',
            'file_url', 'preview_url',
        ]
        read_only_fields = ['content_hash', 'ocr_text', 'ocr_processed', 'ai_suggestions', 'is_signed']

    def _build_version_url(self, obj, inline=False):
        request = self.context.get('request')
        if not request:
            return None
        path = f'/api/records/{obj.record_id}/versions/{obj.id}/download/'
        if inline:
            path += '?inline=1'
        return request.build_absolute_uri(path)

    def get_file_url(self, obj):
        return self._build_version_url(obj, inline=False)

    def get_preview_url(self, obj):
        return self._build_version_url(obj, inline=True)


class RecordListSerializer(serializers.ModelSerializer):
    record_series_name = serializers.CharField(source='record_series.name', read_only=True)
    custodian_name = serializers.CharField(source='custodian.get_full_name', read_only=True)
    version_count = serializers.SerializerMethodField()
    file_name = serializers.CharField(read_only=True, default='')
    mime_type = serializers.CharField(read_only=True, default='')
    file_size = serializers.IntegerField(read_only=True, default=0)
    is_starred = serializers.SerializerMethodField()

    class Meta:
        model = Record
        fields = [
            'id', 'reference_number', 'title', 'document_type', 'classification_level',
            'record_series', 'record_series_name', 'originating_ministry',
            'custodian', 'custodian_name', 'document_date', 'is_vital',
            'is_on_legal_hold', 'is_draft', 'tags', 'version_count',
            'file_name', 'mime_type', 'file_size', 'is_starred',
            'created_at', 'updated_at',
        ]

    def get_is_starred(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, '_user_starred'):
            return obj._user_starred > 0
        return obj.stars.filter(user=request.user).exists()

    def get_version_count(self, obj):
        # Use pre-annotated value when available (avoids N+1 in list views)
        if hasattr(obj, 'version_count'):
            return obj.version_count
        return obj.versions.count()


class RecordDetailSerializer(serializers.ModelSerializer):
    record_series_name = serializers.CharField(source='record_series.name', read_only=True)
    custodian_name = serializers.CharField(source='custodian.get_full_name', read_only=True)
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    latest_version = serializers.SerializerMethodField()
    related_records = serializers.SerializerMethodField()
    version_count = serializers.SerializerMethodField()
    is_starred = serializers.SerializerMethodField()

    class Meta:
        model = Record
        # Explicit field list — never use __all__ on a public serializer as it
        # leaks internal fields (search_vector, etc.) and couples the API to the schema.
        fields = [
            'id', 'reference_number', 'title', 'description',
            'document_type', 'classification_level',
            'record_series', 'record_series_name',
            'originating_ministry',
            'custodian', 'custodian_name',
            'author', 'author_name',
            'document_date', 'received_date',
            'physical_file_ref', 'physical_location',
            'is_vital', 'is_on_legal_hold', 'is_draft',
            'retention_date', 'scheduled_destruction_date',
            'tags', 'related_records',
            'version_count', 'latest_version', 'is_starred',
            'content_hash',
            'created_at', 'updated_at',
        ]

    def get_is_starred(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.stars.filter(user=request.user).exists()

    def get_version_count(self, obj):
        if hasattr(obj, 'version_count'):
            return obj.version_count
        return obj.versions.count()

    def get_latest_version(self, obj):
        version = obj.versions.first()
        if version:
            return RecordVersionSerializer(version, context=self.context).data
        return None

    def get_related_records(self, obj):
        return [
            {'id': str(r.id), 'reference_number': r.reference_number, 'title': r.title}
            for r in obj.related_records.all()[:10]
        ]


class RecordCreateSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    change_summary = serializers.CharField(write_only=True, required=False, default='Initial version')

    class Meta:
        model = Record
        fields = [
            'title', 'description', 'document_type', 'classification_level',
            'record_series', 'originating_ministry', 'custodian', 'document_date',
            'received_date', 'physical_file_ref', 'physical_location', 'is_vital',
            'tags', 'file', 'change_summary',
        ]

    def create(self, validated_data):
        file = validated_data.pop('file')
        change_summary = validated_data.pop('change_summary', 'Initial version')
        request = self.context['request']

        record = Record(**validated_data)
        if not record.custodian:
            record.custodian = request.user
        record.author = request.user
        record.save()

        # Create initial version
        content = file.read()
        import hashlib, mimetypes
        version = RecordVersion(
            record=record,
            version_number=1,
            file=file,
            file_name=file.name,
            file_size=file.size,
            mime_type=file.content_type or mimetypes.guess_type(file.name)[0] or 'application/octet-stream',
            content_hash=hashlib.sha256(content).hexdigest(),
            change_summary=change_summary,
            created_by=request.user,
        )
        version.save()

        # Queue OCR and AI tagging
        from apps.records.tasks import process_record_ocr
        process_record_ocr.delay(str(version.id))

        return record


class RecordUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Record
        fields = [
            'title', 'description', 'document_type', 'classification_level',
            'record_series', 'originating_ministry', 'custodian', 'document_date',
            'received_date', 'physical_file_ref', 'physical_location',
            'is_vital', 'tags', 'retention_date',
        ]


ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/gif',
    'application/zip',
    'application/x-zip-compressed',
    'message/rfc822',  # .eml
    'application/vnd.ms-outlook',  # .msg
}

MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB


class RecordVersionUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    change_summary = serializers.CharField(max_length=500, required=False, default='Updated')

    def validate_file(self, file):
        # Size check
        if file.size > MAX_UPLOAD_SIZE_BYTES:
            raise serializers.ValidationError(
                f'File size {file.size / (1024*1024):.1f} MB exceeds the 100 MB limit.'
            )
        # MIME type check
        import mimetypes
        mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
        if mime not in ALLOWED_MIME_TYPES:
            raise serializers.ValidationError(
                f'File type "{mime}" is not permitted. '
                f'Allowed types: PDF, Word, Excel, PowerPoint, text, CSV, images, ZIP, email.'
            )
        return file


class DocumentPermissionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = DocumentPermission
        fields = [
            'id', 'record', 'user', 'user_name', 'user_email', 'department',
            'can_view', 'can_edit', 'can_download', 'can_share', 'expires_at',
        ]
