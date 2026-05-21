from rest_framework import serializers
from .models import LegalHold, DestructionCertificate, RetentionSchedule


class LegalHoldSerializer(serializers.ModelSerializer):
    applied_by_name = serializers.CharField(source='applied_by.get_full_name', read_only=True)
    lifted_by_name = serializers.CharField(source='lifted_by.get_full_name', read_only=True)
    records_count = serializers.SerializerMethodField()

    class Meta:
        model = LegalHold
        fields = [
            'id', 'title', 'reason', 'hold_type',
            'records', 'record_series',
            'applied_by', 'applied_by_name', 'applied_at',
            'lifted_by', 'lifted_by_name', 'lifted_at',
            'is_active', 'records_count',
        ]
        read_only_fields = ['applied_by', 'applied_at', 'lifted_by', 'lifted_at']

    def get_records_count(self, obj):
        return obj.records.count()


class DestructionCertificateSerializer(serializers.ModelSerializer):
    authorised_by_name = serializers.CharField(source='authorised_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    destroyed_records_count = serializers.SerializerMethodField()

    class Meta:
        model = DestructionCertificate
        fields = [
            'id', 'certificate_number', 'status', 'destruction_method', 'notes',
            'authorised_by', 'authorised_by_name',
            'approved_by', 'approved_by_name',
            'pdf_file',
            'created_at', 'approved_at', 'completed_at',
            'destroyed_records_count',
        ]
        read_only_fields = ['certificate_number', 'authorised_by', 'created_at', 'approved_by', 'approved_at', 'completed_at']

    def get_destroyed_records_count(self, obj):
        return obj.destroyed_records.count()


class RetentionScheduleSerializer(serializers.ModelSerializer):
    record_series_code = serializers.CharField(source='record_series.code', read_only=True)
    record_series_name = serializers.CharField(source='record_series.name', read_only=True)

    class Meta:
        model = RetentionSchedule
        fields = [
            'id', 'record_series', 'record_series_code', 'record_series_name',
            'retention_years', 'review_trigger', 'auto_flag_for_review',
            'disposition_action', 'statutory_basis', 'updated_at',
        ]
