from django.contrib import admin
from .models import AuditLog, CustodyRecord


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Read-only: the audit log is append-only (see AuditLog)."""
    list_display = ['timestamp', 'user_email', 'action', 'record_reference', 'ip_address']
    list_filter = ['action']
    search_fields = ['user_email', 'record_reference', 'ip_address']

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in self.model._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CustodyRecord)
class CustodyRecordAdmin(admin.ModelAdmin):
    list_display = ['record', 'transferred_from', 'transferred_to', 'transfer_type', 'transferred_at']
    readonly_fields = ['transferred_at']
