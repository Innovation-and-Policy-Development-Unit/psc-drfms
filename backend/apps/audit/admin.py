from django.contrib import admin
from .models import AuditLog, CustodyRecord


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'user', 'action', 'record_reference', 'ip_address']
    list_filter = ['action']
    search_fields = ['user__email', 'record_reference', 'ip_address']
    readonly_fields = ['id', 'timestamp']


@admin.register(CustodyRecord)
class CustodyRecordAdmin(admin.ModelAdmin):
    list_display = ['record', 'transferred_from', 'transferred_to', 'transfer_type', 'transferred_at']
    readonly_fields = ['transferred_at']
