from django.db import models
from django.utils import timezone
import uuid


class LegalHold(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=300)
    reason = models.TextField()
    hold_type = models.CharField(max_length=50, choices=[
        ('disciplinary', 'Disciplinary Proceeding'),
        ('inquiry', 'Commission Inquiry'),
        ('litigation', 'Litigation'),
        ('audit', 'Audit'),
        ('other', 'Other'),
    ])
    records = models.ManyToManyField('records.Record', related_name='legal_holds')
    record_series = models.ManyToManyField('records.RecordSeries', blank=True, related_name='legal_holds')
    applied_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='applied_holds')
    applied_at = models.DateTimeField(auto_now_add=True)
    lifted_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='lifted_holds')
    lifted_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-applied_at']

    def __str__(self):
        return self.title

    def lift(self, user):
        self.is_active = False
        self.lifted_by = user
        self.lifted_at = timezone.now()
        self.save(update_fields=['is_active', 'lifted_by', 'lifted_at'])
        for record in self.records.all():
            if not record.legal_holds.filter(is_active=True).exists():
                record.is_on_legal_hold = False
                record.save(update_fields=['is_on_legal_hold'])


class DestructionCertificate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    certificate_number = models.CharField(max_length=100, unique=True)
    authorised_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='destruction_certificates')
    approved_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_destructions')
    destruction_method = models.CharField(max_length=100, default='Digital deletion')
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_destructions')
    rejected_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    pdf_file = models.FileField(upload_to='destruction_certificates/', null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # Separation of duties, enforced by the database as well as the API: whoever
            # authorised a destruction cannot be the person who approves it.
            models.CheckConstraint(
                check=~models.Q(approved_by=models.F('authorised_by')),
                name='destruction_approver_not_authoriser',
            ),
        ]

    def __str__(self):
        return self.certificate_number

    def save(self, *args, **kwargs):
        if not self.certificate_number:
            year = timezone.now().year
            count = DestructionCertificate.objects.filter(created_at__year=year).count() + 1
            self.certificate_number = f"DC-{year}-{count:04d}"
        super().save(*args, **kwargs)


class DispositionReview(models.Model):
    """A record flagged by the retention scan as due for disposition review."""
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved for Disposition'),
        ('dismissed', 'Dismissed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey('records.Record', on_delete=models.CASCADE, related_name='disposition_reviews')
    retention_date = models.DateField()
    proposed_action = models.CharField(max_length=50, choices=[
        ('destroy', 'Destroy'),
        ('archive', 'Archive'),
        ('review', 'Review'),
        ('transfer', 'Transfer to National Archives'),
    ], default='review')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True)
    flagged_at = models.DateTimeField(auto_now_add=True)
    decided_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='disposition_decisions')
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-flagged_at']
        constraints = [
            models.UniqueConstraint(
                fields=['record'],
                condition=models.Q(status='pending'),
                name='unique_pending_disposition_per_record',
            ),
        ]

    def __str__(self):
        return f"Disposition {self.status} for {self.record_id}"

    def decide(self, user, approve: bool, notes: str = ''):
        self.status = 'approved' if approve else 'dismissed'
        self.decided_by = user
        self.decided_at = timezone.now()
        if notes:
            self.notes = notes
        self.save(update_fields=['status', 'decided_by', 'decided_at', 'notes'])


class RetentionSchedule(models.Model):
    record_series = models.OneToOneField('records.RecordSeries', on_delete=models.CASCADE, related_name='retention_schedule')
    retention_years = models.PositiveIntegerField()
    review_trigger = models.CharField(max_length=200, blank=True)
    auto_flag_for_review = models.BooleanField(default=True)
    disposition_action = models.CharField(max_length=50, choices=[
        ('destroy', 'Destroy'),
        ('archive', 'Archive'),
        ('review', 'Review'),
        ('transfer', 'Transfer to National Archives'),
    ], default='review')
    statutory_basis = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.record_series.code} - {self.retention_years} years"
