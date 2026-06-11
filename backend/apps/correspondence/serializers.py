from rest_framework import serializers
from .models import Correspondence


class CorrespondenceSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = Correspondence
        fields = [
            'id', 'reference_number', 'direction', 'subject',
            'sender_name', 'sender_email', 'sender_organization',
            'recipient_name', 'recipient_email', 'recipient_organization',
            'correspondence_date', 'received_date', 'dispatched_date',
            'record', 'assigned_to', 'assigned_to_name',
            'status', 'priority',
            'body_summary', 'notes',
            'is_email_ingested',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['reference_number', 'created_by', 'created_at', 'updated_at', 'is_email_ingested']
