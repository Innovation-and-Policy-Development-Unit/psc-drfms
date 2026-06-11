from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    related_record_reference = serializers.CharField(
        source='related_record.reference_number', read_only=True
    )

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type',
            'related_record', 'related_record_reference',
            'related_url', 'is_read', 'created_at', 'read_at',
        ]
        read_only_fields = ['created_at', 'read_at']
