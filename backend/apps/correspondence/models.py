from django.db import models
import uuid


class Correspondence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_number = models.CharField(max_length=100, unique=True, blank=True)
    direction = models.CharField(max_length=10, choices=[('incoming', 'Incoming'), ('outgoing', 'Outgoing'), ('internal', 'Internal')])
    subject = models.CharField(max_length=500)
    sender_name = models.CharField(max_length=200, blank=True)
    sender_email = models.EmailField(blank=True)
    sender_organization = models.CharField(max_length=200, blank=True)
    recipient_name = models.CharField(max_length=200, blank=True)
    recipient_email = models.EmailField(blank=True)
    recipient_organization = models.CharField(max_length=200, blank=True)
    correspondence_date = models.DateField()
    received_date = models.DateField(null=True, blank=True)
    dispatched_date = models.DateField(null=True, blank=True)
    record = models.ForeignKey('records.Record', null=True, blank=True, on_delete=models.SET_NULL, related_name='correspondence')
    assigned_to = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_correspondence')
    status = models.CharField(max_length=30, choices=[
        ('pending', 'Pending'),
        ('acknowledged', 'Acknowledged'),
        ('in_progress', 'In Progress'),
        ('dispatched', 'Dispatched'),
        ('closed', 'Closed'),
    ], default='pending')
    priority = models.CharField(max_length=10, choices=[('low', 'Low'), ('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], default='normal')
    body_summary = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_email_ingested = models.BooleanField(default=False)
    created_by = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL, related_name='created_correspondence')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Correspondence'

    def __str__(self):
        return f"[{self.reference_number}] {self.subject}"

    def save(self, *args, **kwargs):
        if not self.reference_number:
            from django.utils import timezone
            year = timezone.now().year
            count = Correspondence.objects.filter(created_at__year=year).count() + 1
            dir_code = {'incoming': 'IN', 'outgoing': 'OUT', 'internal': 'INT'}.get(self.direction, 'X')
            self.reference_number = f"CORR-{dir_code}-{year}-{count:05d}"
        super().save(*args, **kwargs)
