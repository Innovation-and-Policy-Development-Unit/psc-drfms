from rest_framework import serializers
from .models import Record, RecordVersion, RecordSeries, DocumentPermission, ClassificationLevel, DocumentType


class RecordSeriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecordSeries
        fields = ['id', 'code', 'name', 'description', 'parent', 'retention_years', 'is_active']


class RecordVersionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = RecordVersion
        fields = [
            'id', 'version_number', 'file_name', 'file_size', 'mime_type',
            'content_hash', 'ocr_text', 'ocr_processed', 'ai_suggestions',
            'is_signed', 'signature_info', 'change_summary',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['content_hash', 'ocr_text', 'ocr_processed', 'ai_suggestions', 'is_signed']


class RecordListSerializer(serializers.ModelSerializer):
    record_series_name = serializers.CharField(source='record_series.name', read_only=True)
    custodian_name = serializers.CharField(source='custodian.get_full_name', read_only=True)
    version_count = serializers.SerializerMethodField()

    class Meta:
        model = Record
        fields = [
            'id', 'reference_number', 'title', 'document_type', 'classification_level',
            'record_series', 'record_series_name', 'originating_ministry',
            'custodian', 'custodian_name', 'document_date', 'is_vital',
            'is_on_legal_hold', 'is_draft', 'tags', 'version_count',
            'created_at', 'updated_at',
        ]

    def get_version_count(self, obj):
        return obj.versions.count()


class RecordDetailSerializer(serializers.ModelSerializer):
    record_series_name = serializers.CharField(source='record_series.name', read_only=True)
    custodian_name = serializers.CharField(source='custodian.get_full_name', read_only=True)
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    latest_version = serializers.SerializerMethodField()
    related_records = serializers.SerializerMethodField()

    class Meta:
        model = Record
        fields = '__all__'

    def get_latest_version(self, obj):
        version = obj.versions.first()
        if version:
            return RecordVersionSerializer(version).data
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


class RecordVersionUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    change_summary = serializers.CharField(max_length=500, required=False, default='Updated')


class DocumentPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentPermission
        fields = ['id', 'record', 'user', 'department', 'can_view', 'can_edit', 'can_download', 'can_share', 'expires_at']
