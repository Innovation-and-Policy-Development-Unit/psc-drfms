import hashlib
import uuid
from django.db import models
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex
from django.utils import timezone


class RecordSeries(models.Model):
    """Records classification scheme - formal hierarchy aligned to OPSC statutory functions."""
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.PROTECT, related_name='children')
    retention_years = models.PositiveIntegerField(default=7)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Record Series'
        verbose_name_plural = 'Record Series'
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ClassificationLevel(models.TextChoices):
    UNCLASSIFIED = 'unclassified', 'Unclassified'
    INTERNAL = 'internal', 'Internal'
    CONFIDENTIAL = 'confidential', 'Confidential'
    RESTRICTED = 'restricted', 'Restricted'
    SECRET = 'secret', 'Secret'


class DocumentType(models.TextChoices):
    CORRESPONDENCE = 'correspondence', 'Correspondence'
    PERSONNEL_FILE = 'personnel_file', 'Personnel File'
    BOARD_PAPER = 'board_paper', 'Board Paper'
    POLICY = 'policy', 'Policy Document'
    CIRCULAR = 'circular', 'Circular'
    REPORT = 'report', 'Report'
    SUBMISSION = 'submission', 'Commission Submission'
    DISCIPLINARY = 'disciplinary', 'Disciplinary File'
    CONTRACT = 'contract', 'Contract'
    FINANCIAL = 'financial', 'Financial Document'
    LEGAL = 'legal', 'Legal Document'
    OTHER = 'other', 'Other'


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_number = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    document_type = models.CharField(max_length=30, choices=DocumentType.choices, default=DocumentType.OTHER)
    classification_level = models.CharField(max_length=20, choices=ClassificationLevel.choices, default=ClassificationLevel.INTERNAL)
    record_series = models.ForeignKey(RecordSeries, null=True, blank=True, on_delete=models.SET_NULL, related_name='records')

    # Metadata
    originating_ministry = models.CharField(max_length=200, blank=True)
    custodian = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='custodian_records')
    author = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='authored_records')
    document_date = models.DateField(null=True, blank=True)
    received_date = models.DateField(null=True, blank=True)

    # Physical file cross-referencing
    physical_file_ref = models.CharField(max_length=200, blank=True)
    physical_location = models.CharField(max_length=300, blank=True)
    qr_code = models.ImageField(upload_to='qr_codes/', null=True, blank=True)

    # Status
    is_vital = models.BooleanField(default=False)
    is_on_legal_hold = models.BooleanField(default=False)
    is_draft = models.BooleanField(default=True)

    # Lifecycle
    retention_date = models.DateField(null=True, blank=True)
    scheduled_destruction_date = models.DateField(null=True, blank=True)
    destroyed_at = models.DateTimeField(null=True, blank=True)
    destruction_certificate = models.ForeignKey('compliance.DestructionCertificate', null=True, blank=True, on_delete=models.SET_NULL, related_name='destroyed_records')

    # Full-text search
    search_vector = SearchVectorField(null=True, blank=True)

    # Tags
    tags = models.JSONField(default=list, blank=True)

    # Related records
    related_records = models.ManyToManyField('self', blank=True, symmetrical=True)

    # Duplicate detection
    content_hash = models.CharField(max_length=64, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            GinIndex(fields=['search_vector'], name='record_search_gin'),
            models.Index(fields=['reference_number']),
            models.Index(fields=['document_type']),
            models.Index(fields=['classification_level']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"[{self.reference_number}] {self.title}"

    def generate_reference_number(self):
        from django.utils import timezone
        year = timezone.now().year
        count = Record.objects.filter(created_at__year=year).count() + 1
        return f"PSC-{year}-{count:05d}"

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = self.generate_reference_number()
        super().save(*args, **kwargs)


class RecordVersion(models.Model):
    """Immutable version history for each record."""
    record = models.ForeignKey(Record, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to='records/versions/')
    file_name = models.CharField(max_length=500)
    file_size = models.PositiveBigIntegerField()
    mime_type = models.CharField(max_length=100)
    content_hash = models.CharField(max_length=64)

    # OCR
    ocr_text = models.TextField(blank=True)
    ocr_processed = models.BooleanField(default=False)
    ocr_language = models.CharField(max_length=20, blank=True)

    # AI metadata suggestions
    ai_suggestions = models.JSONField(default=dict, blank=True)
    ai_processed = models.BooleanField(default=False)

    # Digital signature
    is_signed = models.BooleanField(default=False)
    signature_info = models.JSONField(default=dict, blank=True)

    change_summary = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='record_versions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version_number']
        unique_together = [['record', 'version_number']]

    def __str__(self):
        return f"{self.record.reference_number} v{self.version_number}"

    def compute_hash(self, file_content: bytes) -> str:
        return hashlib.sha256(file_content).hexdigest()


class DocumentPermission(models.Model):
    """Document-level permission overriding role defaults."""
    record = models.ForeignKey(Record, on_delete=models.CASCADE, related_name='permissions')
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, null=True, blank=True, related_name='document_permissions')
    department = models.ForeignKey('accounts.Department', on_delete=models.CASCADE, null=True, blank=True, related_name='document_permissions')
    can_view = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=False)
    can_download = models.BooleanField(default=True)
    can_share = models.BooleanField(default=False)
    granted_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='granted_permissions')
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [['record', 'user'], ['record', 'department']]
