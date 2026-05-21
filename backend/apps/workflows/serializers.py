from rest_framework import serializers
from .models import WorkflowTemplate, WorkflowStep, WorkflowInstance, WorkflowAction


class WorkflowStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowStep
        fields = [
            'id', 'step_number', 'name', 'description',
            'role_required', 'specific_user', 'deadline_working_days', 'is_parallel',
        ]


class WorkflowTemplateSerializer(serializers.ModelSerializer):
    steps = WorkflowStepSerializer(many=True, read_only=True)

    class Meta:
        model = WorkflowTemplate
        fields = ['id', 'name', 'description', 'document_type', 'is_active', 'steps', 'created_at']


class WorkflowActionSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    # Expose instance FK so the frontend can link to the workflow detail page
    instance = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = WorkflowAction
        fields = [
            'id', 'instance', 'step_number', 'step_name',
            'assigned_to', 'assigned_to_name',
            'action', 'comments', 'deadline', 'actioned_at',
        ]


class WorkflowInstanceSerializer(serializers.ModelSerializer):
    actions = WorkflowActionSerializer(many=True, read_only=True)
    record_reference = serializers.CharField(source='record.reference_number', read_only=True)
    initiated_by_name = serializers.CharField(source='initiated_by.get_full_name', read_only=True)

    class Meta:
        model = WorkflowInstance
        fields = [
            'id', 'record', 'record_reference', 'template', 'title',
            'current_step', 'status',
            'initiated_by', 'initiated_by_name',
            'initiated_at', 'completed_at', 'notes', 'actions',
        ]
