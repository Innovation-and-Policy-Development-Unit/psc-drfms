from django.db import models
import secrets
import uuid


class ApiKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    key = models.CharField(max_length=64, unique=True)
    key_prefix = models.CharField(max_length=8)
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='api_keys')
    scopes = models.JSONField(default=list)
    rate_limit_per_min = models.PositiveIntegerField(default=60)
    is_active = models.BooleanField(default=True)
    last_used = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.key:
            raw = secrets.token_urlsafe(40)
            self.key = raw
            self.key_prefix = raw[:8]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"


class WebhookEndpoint(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    url = models.URLField()
    secret = models.CharField(max_length=64)
    events = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.secret:
            self.secret = secrets.token_hex(32)
        super().save(*args, **kwargs)
