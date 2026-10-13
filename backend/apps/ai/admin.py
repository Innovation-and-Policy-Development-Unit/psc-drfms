from django.contrib import admin

from .models import AiCallLog


@admin.register(AiCallLog)
class AiCallLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'feature', 'provider', 'model', 'external', 'user', 'record', 'ok', 'duration_ms']
    list_filter = ['feature', 'provider', 'external', 'ok']
    readonly_fields = [f.name for f in AiCallLog._meta.fields]

    def has_add_permission(self, request):
        return False
