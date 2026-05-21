from django.contrib import admin
from .models import LegalHold, DestructionCertificate, RetentionSchedule


@admin.register(LegalHold)
class LegalHoldAdmin(admin.ModelAdmin):
    list_display = ['title', 'hold_type', 'applied_by', 'applied_at', 'is_active']
    list_filter = ['hold_type', 'is_active']


@admin.register(DestructionCertificate)
class DestructionCertificateAdmin(admin.ModelAdmin):
    list_display = ['certificate_number', 'status', 'authorised_by', 'created_at']
    list_filter = ['status']
    readonly_fields = ['certificate_number', 'created_at']


@admin.register(RetentionSchedule)
class RetentionScheduleAdmin(admin.ModelAdmin):
    list_display = ['record_series', 'retention_years', 'disposition_action']
