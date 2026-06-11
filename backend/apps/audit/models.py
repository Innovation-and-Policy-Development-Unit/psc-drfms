from django.db import models
import uuid


class AuditAction(models.TextChoices):
    VIEW = 'view', 'View'
    CREATE = 'create', 'Create'
    UPDATE = 'update', 'Update'
    DELETE = 'delete', 'Delete'
    DOWNLOAD = 'download', 'Download'
    UPLOAD_VERSION = 'upload_version', 'Upload Version'
    APPROVE = 'approve', 'Approve'
    REJECT = 'reject', 'Reject'
    SHARE = 'share', 'Share'
    SHARE_ACCESS = 'share_access', 'Shared Link Access'
    SIGN = 'sign', 'Digital Signature Applied'
    LEGAL_HOLD = 'legal_hold', 'Legal Hold Applied'
    LEGAL_HOLD_LIFT = 'legal_hold_lift', 'Legal Hold Lifted'
    DESTROY = 'destroy', 'Destroyed'
    CUSTODY_TRANSFER = 'custody_transfer', 'Custody Transfer'
    LOGIN = 'login', 'Login'
    LOGOUT = 'logout', 'Logout'
    LOGIN_FAILED = 'login_failed', 'Login Failed'
    EXPORT = 'export', 'Export'


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='audit_logs')
    action = models.CharField(max_length=30, choices=AuditAction.choices)
    record = models.ForeignKey('records.Record', null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_logs')
    record_reference = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    extra = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['record', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.user} {self.action} {self.record_reference} at {self.timestamp}"


class CustodyRecord(models.Model):
    """Chain of custody — every physical/digital transfer of a record."""
    record = models.ForeignKey('records.Record', on_delete=models.CASCADE, related_name='custody_chain')
    transferred_from = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='custody_given')
    transferred_to = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='custody_received')
    transfer_type = models.CharField(max_length=50, choices=[('digital', 'Digital'), ('physical', 'Physical'), ('both', 'Both')])
    notes = models.TextField(blank=True)
    transferred_at = models.DateTimeField(auto_now_add=True)
    recorded_by = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='custody_recorded')

    class Meta:
        ordering = ['-transferred_at']
