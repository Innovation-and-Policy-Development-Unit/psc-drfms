from django.db import models
from django.utils import timezone
import uuid


class WorkflowTemplate(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    document_type = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class WorkflowStep(models.Model):
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.CASCADE, related_name='steps')
    step_number = models.PositiveIntegerField()
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True)
    role_required = models.CharField(max_length=30, blank=True)
    specific_user = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.SET_NULL)
    deadline_working_days = models.PositiveIntegerField(default=5)
    is_parallel = models.BooleanField(default=False)

    class Meta:
        ordering = ['step_number']
        unique_together = [['template', 'step_number']]


class WorkflowInstance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey('records.Record', on_delete=models.CASCADE, related_name='workflows')
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.SET_NULL, null=True)
    title = models.CharField(max_length=300)
    current_step = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('revision_required', 'Revision Required'),
        ('cancelled', 'Cancelled'),
    ], default='pending')
    initiated_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='initiated_workflows')
    initiated_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-initiated_at']

    def __str__(self):
        return f"{self.title} [{self.status}]"


class WorkflowAction(models.Model):
    instance = models.ForeignKey(WorkflowInstance, on_delete=models.CASCADE, related_name='actions')
    step_number = models.PositiveIntegerField()
    step_name = models.CharField(max_length=200)
    assigned_to = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='workflow_tasks')
    delegated_from = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='delegated_tasks')
    action = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('revision_required', 'Revision Required'),
        ('escalated', 'Escalated'),
    ], default='pending')
    comments = models.TextField(blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    actioned_at = models.DateTimeField(null=True, blank=True)
    is_digital_signed = models.BooleanField(default=False)

    class Meta:
        ordering = ['step_number', '-actioned_at']

    def __str__(self):
        return f"{self.instance.title} - Step {self.step_number} ({self.action})"

    def action_by(self, user, action, comments=''):
        self.action = action
        self.comments = comments
        self.actioned_at = timezone.now()
        self.save(update_fields=['action', 'comments', 'actioned_at'])

        # Progress the workflow
        self.instance.refresh_from_db()
        if action == 'approved':
            self._advance_workflow(user)
        elif action in ('rejected', 'revision_required'):
            self.instance.status = action
            self.instance.completed_at = timezone.now()
            self.instance.save(update_fields=['status', 'completed_at'])

    def _advance_workflow(self, user):
        instance = self.instance
        next_step = self.step_number + 1
        if instance.template:
            remaining = WorkflowStep.objects.filter(
                template=instance.template, step_number=next_step
            ).first()
            if remaining:
                instance.current_step = next_step
                instance.status = 'in_progress'
                instance.save(update_fields=['current_step', 'status'])
                from apps.notifications.utils import send_notification
                send_notification(
                    user_id=remaining.specific_user_id or user.id,
                    title='Workflow Action Required',
                    message=f'Your approval is required for: {instance.title}',
                    notification_type='workflow',
                    related_record_id=str(instance.record_id),
                )
                return
        instance.status = 'approved'
        instance.completed_at = timezone.now()
        instance.save(update_fields=['status', 'completed_at'])
