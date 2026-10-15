from django.db import transaction
from rest_framework import serializers

from apps.records.models import Record

from .destruction import blocker_for_request
from .models import LegalHold, DestructionCertificate, RetentionSchedule, DispositionReview


class DispositionReviewSerializer(serializers.ModelSerializer):
    record_reference = serializers.CharField(source='record.reference_number', read_only=True)
    record_title = serializers.CharField(source='record.title', read_only=True)
    record_series_code = serializers.CharField(source='record.record_series.code', read_only=True, default=None)
    decided_by_name = serializers.CharField(source='decided_by.get_full_name', read_only=True, default=None)

    class Meta:
        model = DispositionReview
        fields = [
            'id', 'record', 'record_reference', 'record_title', 'record_series_code',
            'retention_date', 'proposed_action', 'status', 'notes',
            'flagged_at', 'decided_by', 'decided_by_name', 'decided_at',
        ]
        read_only_fields = fields


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
    rejected_by_name = serializers.CharField(source='rejected_by.get_full_name', read_only=True)
    destroyed_records_count = serializers.SerializerMethodField()
    # Records to destroy, chosen when the certificate is requested; each must have an approved
    # disposition review for destruction and no legal hold or open workflow
    records = serializers.PrimaryKeyRelatedField(
        queryset=Record.objects.all(), many=True, write_only=True, allow_empty=False,
    )
    record_refs = serializers.SerializerMethodField()

    class Meta:
        model = DestructionCertificate
        fields = [
            'id', 'certificate_number', 'status', 'destruction_method', 'notes',
            'authorised_by', 'authorised_by_name',
            'approved_by', 'approved_by_name',
            'rejected_by', 'rejected_by_name', 'rejected_at',
            'pdf_file',
            'created_at', 'approved_at', 'completed_at',
            'destroyed_records_count', 'records', 'record_refs',
        ]
        read_only_fields = [
            'certificate_number', 'status', 'authorised_by', 'created_at',
            'approved_by', 'approved_at', 'rejected_by', 'rejected_at', 'completed_at', 'pdf_file',
        ]

    def get_destroyed_records_count(self, obj):
        return obj.destroyed_records.count()

    def get_record_refs(self, obj):
        return list(obj.destroyed_records.order_by('reference_number').values_list('reference_number', flat=True))

    def validate_records(self, records):
        problems = []
        for record in records:
            why = blocker_for_request(record)
            if why:
                problems.append(f'{record.reference_number}: {why}')
        if problems:
            raise serializers.ValidationError(problems)
        return records

    @transaction.atomic
    def create(self, validated_data):
        records = validated_data.pop('records')
        cert = DestructionCertificate.objects.create(**validated_data)
        Record.objects.filter(pk__in=[r.pk for r in records]).update(destruction_certificate=cert)
        return cert


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
