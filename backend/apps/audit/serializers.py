from rest_framework import serializers
from .models import AuditLog, CustodyRecord


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_name', 'action',
            'record', 'record_reference', 'ip_address', 'extra', 'timestamp',
        ]


class CustodyRecordSerializer(serializers.ModelSerializer):
    transferred_from_name = serializers.CharField(source='transferred_from.get_full_name', read_only=True)
    transferred_to_name = serializers.CharField(source='transferred_to.get_full_name', read_only=True)

    class Meta:
        model = CustodyRecord
        fields = '__all__'
