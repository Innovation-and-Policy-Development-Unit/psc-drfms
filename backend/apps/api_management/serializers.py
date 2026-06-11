from rest_framework import serializers
from .models import ApiKey, WebhookEndpoint


class ApiKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApiKey
        fields = [
            'id', 'name', 'key_prefix', 'scopes',
            'rate_limit_per_min', 'is_active',
            'last_used', 'expires_at', 'created_at',
        ]
        read_only_fields = ['key_prefix', 'last_used', 'created_at']


class ApiKeyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApiKey
        fields = ['name', 'scopes', 'rate_limit_per_min', 'expires_at']

    def create(self, validated_data):
        return ApiKey.objects.create(
            user=self.context['request'].user, **validated_data
        )


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEndpoint
        fields = ['id', 'name', 'url', 'events', 'is_active', 'created_at']
        read_only_fields = ['created_at']
