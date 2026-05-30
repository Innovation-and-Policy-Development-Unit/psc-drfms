from django.utils import timezone
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
    instance = serializers.PrimaryKeyRelatedField(read_only=True)
    is_overdue = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowAction
        fields = [
            'id', 'instance', 'step_number', 'step_name',
            'assigned_to', 'assigned_to_name',
            'action', 'comments', 'deadline', 'actioned_at',
            'is_overdue', 'days_remaining',
        ]

    def get_is_overdue(self, obj):
        if obj.action != 'pending' or not obj.deadline:
            return False
        return obj.deadline < timezone.now()

    def get_days_remaining(self, obj):
        if not obj.deadline or obj.action != 'pending':
            return None
        delta = obj.deadline.date() - timezone.now().date()
        return delta.days


class WorkflowInstanceSerializer(serializers.ModelSerializer):
    actions = WorkflowActionSerializer(many=True, read_only=True)
    record_reference = serializers.CharField(source='record.reference_number', read_only=True)
    initiated_by_name = serializers.CharField(source='initiated_by.get_full_name', read_only=True)
    current_step_name = serializers.SerializerMethodField()
    overdue_steps_count = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowInstance
        fields = [
            'id', 'record', 'record_reference', 'template', 'title',
            'current_step', 'current_step_name', 'status',
            'initiated_by', 'initiated_by_name',
            'initiated_at', 'completed_at', 'notes', 'actions',
            'overdue_steps_count', 'is_overdue', 'days_remaining',
        ]

    def get_current_step_name(self, obj):
        pending = obj.actions.filter(step_number=obj.current_step, action='pending').first()
        if pending:
            return pending.step_name
        step = obj.actions.filter(step_number=obj.current_step).first()
        return step.step_name if step else ''

    def get_overdue_steps_count(self, obj):
        now = timezone.now()
        return obj.actions.filter(action='pending', deadline__lt=now).count()

    def get_is_overdue(self, obj):
        return self.get_overdue_steps_count(obj) > 0

    def get_days_remaining(self, obj):
        pending = obj.actions.filter(action='pending').order_by('step_number').first()
        if not pending or not pending.deadline:
            return None
        delta = pending.deadline.date() - timezone.now().date()
        return delta.days
