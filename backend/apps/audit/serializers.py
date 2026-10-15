from rest_framework import serializers
from .models import AuditLog, CustodyRecord


class AuditLogSerializer(serializers.ModelSerializer):
    # Falls back to the text captured when the entry was written, so it still names the person
    # after their account has been removed
    user_email = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_name', 'action',
            'record', 'record_reference', 'ip_address', 'extra', 'timestamp',
            'seq', 'hash',
        ]

    def get_user_email(self, obj):
        return obj.user.email if obj.user_id else obj.user_email

    def get_user_name(self, obj):
        return obj.user.get_full_name() if obj.user_id else obj.user_name


class CustodyRecordSerializer(serializers.ModelSerializer):
    transferred_from_name = serializers.CharField(source='transferred_from.get_full_name', read_only=True)
    transferred_to_name = serializers.CharField(source='transferred_to.get_full_name', read_only=True)

    class Meta:
        model = CustodyRecord
        fields = '__all__'
