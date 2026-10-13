from django.contrib import admin

from .models import BackupRun


@admin.register(BackupRun)
class BackupRunAdmin(admin.ModelAdmin):
    list_display = ('started_at', 'status', 'trigger', 'files_copied', 'database_bytes')
    readonly_fields = [f.name for f in BackupRun._meta.fields]
