from django.contrib import admin
from .models import SavedSearch


@admin.register(SavedSearch)
class SavedSearchAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'query', 'alert_on_new', 'created_at']
