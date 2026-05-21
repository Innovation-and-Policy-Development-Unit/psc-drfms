from django.contrib import admin
from .models import Record, RecordVersion, RecordSeries, DocumentPermission


@admin.register(RecordSeries)
class RecordSeriesAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'retention_years', 'is_active']
    search_fields = ['code', 'name']


@admin.register(Record)
class RecordAdmin(admin.ModelAdmin):
    list_display = ['reference_number', 'title', 'document_type', 'classification_level', 'is_vital', 'is_on_legal_hold']
    list_filter = ['document_type', 'classification_level', 'is_vital', 'is_on_legal_hold']
    search_fields = ['reference_number', 'title', 'description']
    readonly_fields = ['id', 'reference_number', 'created_at', 'updated_at', 'search_vector']


@admin.register(RecordVersion)
class RecordVersionAdmin(admin.ModelAdmin):
    list_display = ['record', 'version_number', 'file_name', 'file_size', 'ocr_processed', 'ai_processed']
    readonly_fields = ['content_hash', 'created_at']
