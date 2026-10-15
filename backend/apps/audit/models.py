from django.db import connection, models, transaction
from django.utils import timezone
import uuid

# Arbitrary constant: the Postgres advisory lock that serialises audit writes
CHAIN_LOCK_KEY = 7_204_001


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
    RESTORE = 'restore', 'Restored from Recycle bin'


class AppendOnlyError(Exception):
    """An audit row was asked to change after it was written."""


class AuditLog(models.Model):
    """One immutable fact. Rows are only ever inserted:

    * a database trigger (migration 0004) rejects any UPDATE or DELETE, except the foreign keys
      ``user`` / ``record`` being cleared when that user or record is later erased;
    * who and what are also kept as text (``user_email``, ``user_name``, ``record_reference``) so the
      row still says who did what after the user or record is gone;
    * rows form a hash chain (``prev_hash`` -> ``hash``), checked by ``manage.py verify_audit_chain``.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='audit_logs')
    user_email = models.CharField(max_length=254, blank=True)
    user_name = models.CharField(max_length=300, blank=True)
    action = models.CharField(max_length=30, choices=AuditAction.choices)
    record = models.ForeignKey('records.Record', null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_logs')
    record_reference = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    extra = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, editable=False)
    # Hash chain. Rows written before the chain existed were back-filled by migration 0004.
    seq = models.BigIntegerField(null=True, blank=True, unique=True, editable=False)
    prev_hash = models.CharField(max_length=64, blank=True, editable=False)
    hash = models.CharField(max_length=64, blank=True, editable=False)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['record', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.user_email or self.user} {self.action} {self.record_reference} at {self.timestamp}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise AppendOnlyError('Audit log entries cannot be changed.')
        from . import chain

        if self.user_id and not (self.user_email or self.user_name):
            self.user_email = self.user.email
            self.user_name = self.user.get_full_name()[:300]
        if self.record_id and not self.record_reference:
            self.record_reference = self.record.reference_number
        self.timestamp = timezone.now()
        self.user_agent = self.user_agent or ''

        with transaction.atomic():
            # One writer at a time so the chain has a single order; released at commit
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(%s)', [CHAIN_LOCK_KEY])
            last = AuditLog.objects.filter(seq__isnull=False).order_by('-seq').only('seq', 'hash').first()
            self.seq = (last.seq + 1) if last else 1
            self.prev_hash = last.hash if last else chain.GENESIS
            self.hash = chain.compute_hash(self.prev_hash, chain.payload_for(self))
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise AppendOnlyError('Audit log entries cannot be deleted.')


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
