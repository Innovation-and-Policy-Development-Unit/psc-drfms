from django.contrib import admin
from .models import SharedLink, SharedLinkAccess


@admin.register(SharedLink)
class SharedLinkAdmin(admin.ModelAdmin):
    list_display = ['record', 'recipient_email', 'allow_download', 'expires_at', 'is_active', 'access_count']
    list_filter = ['is_active', 'allow_download']
    readonly_fields = ['token', 'created_at', 'access_count']
