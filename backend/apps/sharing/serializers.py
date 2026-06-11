from rest_framework import serializers
from .models import SharedLink, SharedLinkAccess


class SharedLinkSerializer(serializers.ModelSerializer):
    record_title = serializers.CharField(source='record.title', read_only=True)
    record_reference = serializers.CharField(source='record.reference_number', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    # password is write-only — never returned in responses
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = SharedLink
        fields = [
            'id', 'record', 'record_title', 'record_reference',
            'record_version', 'token',
            'created_by', 'recipient_email', 'recipient_name',
            'password', 'allow_download',
            'expires_at', 'is_active', 'access_count',
            'created_at', 'is_expired',
        ]
        read_only_fields = ['token', 'created_by', 'access_count', 'created_at']

    def create(self, validated_data):
        from django.contrib.auth.hashers import make_password
        password = validated_data.pop('password', '')
        link = SharedLink(**validated_data)
        link.created_by = self.context['request'].user
        if password:
            link.password = make_password(password)
        link.save()
        return link


class SharedLinkAccessSerializer(serializers.ModelSerializer):
    class Meta:
        model = SharedLinkAccess
        fields = ['id', 'accessed_at', 'ip_address', 'user_agent']
