from django.contrib import admin
from .models import Correspondence


@admin.register(Correspondence)
class CorrespondenceAdmin(admin.ModelAdmin):
    list_display = ['reference_number', 'subject', 'direction', 'status', 'priority', 'correspondence_date']
    list_filter = ['direction', 'status', 'priority']
    search_fields = ['reference_number', 'subject', 'sender_name']
    readonly_fields = ['reference_number', 'created_at', 'updated_at']
