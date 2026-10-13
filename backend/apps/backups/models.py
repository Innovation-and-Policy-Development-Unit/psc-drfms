import uuid

from django.conf import settings
from django.db import models

from . import crypto


class Frequency(models.TextChoices):
    DAILY = 'daily', 'Daily'
    WEEKLY = 'weekly', 'Weekly'


class BackupSettings(models.Model):
    """Where and when DRFMS backs itself up to a Windows (SMB) share. Single row, pk=1."""
    enabled = models.BooleanField(default=False)
    server = models.CharField(max_length=255, blank=True, help_text='Host name or IP of the file server')
    share = models.CharField(max_length=255, blank=True, help_text='Share name, e.g. backups')
    folder = models.CharField(max_length=255, blank=True, default='DRFMS-Backups')
    domain = models.CharField(max_length=255, blank=True)
    username = models.CharField(max_length=255, blank=True)
    password_enc = models.TextField(blank=True)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.DAILY)
    run_hour = models.PositiveSmallIntegerField(default=1)
    weekday = models.PositiveSmallIntegerField(default=6, help_text='0 = Monday ... 6 = Sunday (weekly only)')
    keep_database_copies = models.PositiveSmallIntegerField(default=14)
    encrypt = models.BooleanField(default=False, help_text='Encrypt everything written to the share')
    passphrase_enc = models.TextField(blank=True)
    last_alert_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Backup settings'
        verbose_name_plural = 'Backup settings'

    def __str__(self):
        return f'Backup to {self.server}/{self.share}' if self.server else 'Backup (not configured)'

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def password(self) -> str:
        return crypto.decrypt(self.password_enc)

    @password.setter
    def password(self, value: str):
        self.password_enc = crypto.encrypt(value)

    @property
    def passphrase(self) -> str:
        return crypto.decrypt(self.passphrase_enc)

    @passphrase.setter
    def passphrase(self, value: str):
        self.passphrase_enc = crypto.encrypt(value)

    @property
    def credentials_unreadable(self) -> bool:
        """Saved secrets that can no longer be decrypted (for example after SECRET_KEY changed)."""
        return bool(self.password_enc and not self.password) or bool(self.passphrase_enc and not self.passphrase)

    @property
    def configured(self) -> bool:
        return bool(self.server and self.share and self.username and self.password) and not (
            self.encrypt and not self.passphrase)


class RunStatus(models.TextChoices):
    RUNNING = 'running', 'Running'
    SUCCESS = 'success', 'Succeeded'
    FAILED = 'failed', 'Failed'


class BackupRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=10, choices=RunStatus.choices, default=RunStatus.RUNNING)
    trigger = models.CharField(max_length=10, default='scheduled')  # scheduled | manual
    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    database_file = models.CharField(max_length=255, blank=True)
    database_bytes = models.BigIntegerField(default=0)
    files_copied = models.IntegerField(default=0)
    files_skipped = models.IntegerField(default=0)
    files_bytes = models.BigIntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
