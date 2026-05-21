from django.contrib import admin
from .models import WorkflowTemplate, WorkflowStep, WorkflowInstance, WorkflowAction


class WorkflowStepInline(admin.TabularInline):
    model = WorkflowStep
    extra = 1


@admin.register(WorkflowTemplate)
class WorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'document_type', 'is_active']
    inlines = [WorkflowStepInline]


@admin.register(WorkflowInstance)
class WorkflowInstanceAdmin(admin.ModelAdmin):
    list_display = ['title', 'record', 'status', 'current_step', 'initiated_at']
    list_filter = ['status']
    readonly_fields = ['id', 'initiated_at']
