from django.conf import settings
from django.db import models


class AppearanceSettings(models.Model):
    """Organisation-wide look of the interface (a single row, pk=1).

    ``default_*`` apply to anyone who has not chosen their own look. When
    ``locked`` is set, everyone sees the defaults and personal choices are ignored.
    """
    default_theme = models.CharField(max_length=32, default='psc-blue')
    default_mode = models.CharField(max_length=10, default='light')
    default_density = models.CharField(max_length=12, default='comfortable')
    default_radius = models.CharField(max_length=10, default='default')
    locked = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Appearance settings'
        verbose_name_plural = 'Appearance settings'

    def __str__(self):
        return f'Appearance ({self.default_theme}, {"locked" if self.locked else "open"})'

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class OneDriveSettings(models.Model):
    """Lets users import files from their own Microsoft 365 OneDrive (single row, pk=1).

    Only public identifiers live here. Each user signs in to Microsoft in their own
    browser; no Microsoft token or secret is ever sent to or stored by DRFMS.
    """
    enabled = models.BooleanField(default=False)
    client_id = models.CharField(max_length=64, blank=True, help_text='Application (client) ID from Microsoft Entra ID')
    tenant_id = models.CharField(max_length=64, blank=True, help_text='Directory (tenant) ID, or "organizations"')
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'OneDrive settings'
        verbose_name_plural = 'OneDrive settings'

    def __str__(self):
        return f'OneDrive import ({"on" if self.enabled else "off"})'

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
