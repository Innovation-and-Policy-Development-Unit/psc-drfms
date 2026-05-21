from django.db import models
import uuid


class NotificationType(models.TextChoices):
    INFO = 'info', 'Info'
    SUCCESS = 'success', 'Success'
    WARNING = 'warning', 'Warning'
    ERROR = 'error', 'Error'
    WORKFLOW = 'workflow', 'Workflow'
    COMMENT = 'comment', 'Comment'
    MENTION = 'mention', 'Mention'
    DEADLINE = 'deadline', 'Deadline'
    SHARE = 'share', 'Share'
    LEGAL_HOLD = 'legal_hold', 'Legal Hold'


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices, default=NotificationType.INFO)
    related_record = models.ForeignKey('records.Record', null=True, blank=True, on_delete=models.SET_NULL)
    related_url = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['user', 'is_read', 'created_at'])]

    def __str__(self):
        return f"[{self.notification_type}] {self.title} -> {self.user.email}"
