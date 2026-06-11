from django.db import models
from django.utils import timezone
import secrets
import uuid


class SharedLink(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey('records.Record', on_delete=models.CASCADE, related_name='shared_links')
    record_version = models.ForeignKey('records.RecordVersion', on_delete=models.SET_NULL, null=True, blank=True, related_name='shared_links')
    token = models.CharField(max_length=64, unique=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='created_shared_links')
    recipient_email = models.EmailField(blank=True)
    recipient_name = models.CharField(max_length=200, blank=True)
    allow_download = models.BooleanField(default=False)
    password = models.CharField(max_length=128, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    access_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        if self.expires_at and timezone.now() > self.expires_at:
            return True
        return False

    @property
    def is_accessible(self):
        return self.is_active and not self.is_expired


class SharedLinkAccess(models.Model):
    shared_link = models.ForeignKey(SharedLink, on_delete=models.CASCADE, related_name='accesses')
    accessed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ['-accessed_at']
