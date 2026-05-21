from django.contrib import admin
from .models import ApiKey, WebhookEndpoint


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = ['name', 'key_prefix', 'user', 'is_active', 'last_used', 'created_at']
    list_filter = ['is_active']
    readonly_fields = ['id', 'key', 'key_prefix', 'created_at', 'last_used']


@admin.register(WebhookEndpoint)
class WebhookEndpointAdmin(admin.ModelAdmin):
    list_display = ['name', 'url', 'is_active', 'created_at']
    list_filter = ['is_active']
