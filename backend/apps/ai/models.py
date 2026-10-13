from django.conf import settings
from django.db import models


class AiCallLog(models.Model):
    """One row per model call: who, what for, which engine. Never stores prompt or answer text."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='ai_calls')
    feature = models.CharField(max_length=40)
    provider = models.CharField(max_length=20)
    model = models.CharField(max_length=100, blank=True)
    external = models.BooleanField(default=False)
    record = models.ForeignKey('records.Record', null=True, blank=True, on_delete=models.SET_NULL, related_name='ai_calls')
    ok = models.BooleanField(default=True)
    error = models.CharField(max_length=300, blank=True)
    prompt_chars = models.PositiveIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['-created_at'], name='ai_aicalllog_created_idx')]

    def __str__(self):
        return f'{self.feature} via {self.provider} ({"ok" if self.ok else "failed"})'
