from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from .models import WorkflowTemplate, WorkflowStep, WorkflowInstance, WorkflowAction
from .serializers import (
    WorkflowTemplateSerializer, WorkflowInstanceSerializer,
    WorkflowActionSerializer,
)
from apps.accounts.permissions import IsRecordsOfficerOrAbove, IsAdministrator


class WorkflowTemplateListView(generics.ListCreateAPIView):
    queryset = WorkflowTemplate.objects.prefetch_related('steps').all()
    serializer_class = WorkflowTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]


class WorkflowTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = WorkflowTemplate.objects.prefetch_related('steps').all()
    serializer_class = WorkflowTemplateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]


class WorkflowInstanceListView(generics.ListCreateAPIView):
    serializer_class = WorkflowInstanceSerializer
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def get_queryset(self):
        return WorkflowInstance.objects.select_related(
            'record', 'template', 'initiated_by',
        ).prefetch_related('actions__assigned_to')

    def perform_create(self, serializer):
        instance = serializer.save(initiated_by=self.request.user, status='in_progress')
        # Create first action based on template
        if instance.template:
            first_step = WorkflowStep.objects.filter(template=instance.template, step_number=1).first()
            if first_step:
                import datetime
                deadline = timezone.now() + datetime.timedelta(days=first_step.deadline_working_days)
                WorkflowAction.objects.create(
                    instance=instance,
                    step_number=1,
                    step_name=first_step.name,
                    assigned_to=first_step.specific_user or self.request.user,
                    deadline=deadline,
                )


class WorkflowInstanceDetailView(generics.RetrieveAPIView):
    queryset = WorkflowInstance.objects.select_related('record', 'template').prefetch_related('actions__assigned_to')
    serializer_class = WorkflowInstanceSerializer
    permission_classes = [permissions.IsAuthenticated]


class WorkflowActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        instance = WorkflowInstance.objects.get(pk=pk)
        action_str = request.data.get('action')
        comments = request.data.get('comments', '')

        if action_str not in ('approved', 'rejected', 'revision_required'):
            return Response({'detail': 'Invalid action.'}, status=400)

        current_action = WorkflowAction.objects.filter(
            instance=instance,
            step_number=instance.current_step,
            action='pending',
        ).first()

        if not current_action:
            return Response({'detail': 'No pending action at this step.'}, status=400)

        if current_action.assigned_to != request.user:
            return Response({'detail': 'You are not assigned to this step.'}, status=403)

        current_action.action_by(request.user, action_str, comments)

        from apps.audit.utils import log_action
        log_action(request, action_str, instance.record, extra={'workflow_id': str(instance.id), 'step': instance.current_step})

        return Response({'detail': f'Workflow step {action_str}.'})


class MyTasksView(generics.ListAPIView):
    serializer_class = WorkflowActionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkflowAction.objects.filter(
            assigned_to=self.request.user, action='pending'
        ).select_related('instance__record', 'instance__template')
