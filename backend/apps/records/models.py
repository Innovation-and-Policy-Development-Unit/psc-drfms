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
    # Recycle bin: set together with destroyed_at (which hides the record everywhere). Restoring clears all three.
    # A deleted record is only erased through the destruction-certificate process, never from the bin.
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deleted_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='deleted_records')
    destruction_certificate = models.ForeignKey('compliance.DestructionCertificate', null=True, blank=True, on_delete=models.SET_NULL, related_name='destroyed_records')

    # Full-text search
    search_vector = SearchVectorField(null=True, blank=True)

    # Tags
    tags = models.JSONField(default=list, blank=True)
    # Extra fields defined per document type (see MetadataProfile), e.g. {'party': 'Acme Ltd', 'amount': '1500000'}
    custom_fields = models.JSONField(default=dict, blank=True)

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
            GinIndex(fields=['title'], name='record_title_trgm', opclasses=['gin_trgm_ops']),
            GinIndex(fields=['reference_number'], name='record_ref_trgm', opclasses=['gin_trgm_ops']),
            models.Index(fields=['reference_number']),
            models.Index(fields=['document_type']),
            models.Index(fields=['classification_level']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"[{self.reference_number}] {self.title}"

    @classmethod
    def _next_sequence(cls, year: int) -> int:
        """
        Atomically increment a per-year counter using a SELECT … FOR UPDATE
        on a dedicated sequence row, avoiding the count+1 race condition.
        Falls back to a simple count if the sequence table doesn't exist yet.
        """
        from django.db import connection, transaction
        try:
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO records_refsequence (year, last_value)
                        VALUES (%s, 1)
                        ON CONFLICT (year) DO UPDATE
                            SET last_value = records_refsequence.last_value + 1
                        RETURNING last_value
                        """,
                        [year],
                    )
                    return cur.fetchone()[0]
        except Exception:
            # Fallback during initial migration (table may not exist yet)
            return cls.objects.filter(created_at__year=year).count() + 1

    def generate_reference_number(self):
        from django.utils import timezone
        year = timezone.now().year
        seq = Record._next_sequence(year)
        return f"PSC-{year}-{seq:05d}"

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
    ai_summary = models.TextField(blank=True)
    # '' (never attempted / AI not permitted) | 'pending' | 'ready' | 'failed'
    ai_summary_status = models.CharField(max_length=10, blank=True)
    # sha256 of the OCR text the summary was written from; the summary is kept while it still matches
    ai_summary_hash = models.CharField(max_length=64, blank=True)
    ai_engine = models.CharField(max_length=80, blank=True)  # e.g. 'anthropic:claude-sonnet-5-5'; empty = built-in heuristics
    # '' | 'auto_filed' | 'needs_review' | 'reviewed'
    ai_review_status = models.CharField(max_length=20, blank=True, db_index=True)

    # First-page preview for the file browser, rendered on first request (see thumbnails.py)
    thumbnail = models.ImageField(upload_to='records/thumbnails/', blank=True)
    thumbnail_failed = models.BooleanField(default=False)

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


class PinnedView(models.Model):
    """A user's Quick access shortcut: a saved location in the app, e.g. /browse?record_series=3."""
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='pinned_views')
    label = models.CharField(max_length=80)
    target = models.CharField(max_length=300)
    # '' = private; 'department' = everyone in the owner's department; 'all' = everyone (administrators only)
    shared_with = models.CharField(max_length=12, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        unique_together = [['user', 'target']]

    def __str__(self):
        return f'{self.user_id}: {self.label}'


class RecordRelation(models.Model):
    """A typed link between two records: a reply, a superseding version, a reference, or plain 'related'."""
    RELATED = 'related'
    REPLIES_TO = 'replies_to'
    SUPERSEDES = 'supersedes'
    REFERS_TO = 'refers_to'
    TYPE_CHOICES = [
        (RELATED, 'Related to'),
        (REPLIES_TO, 'Replies to'),
        (SUPERSEDES, 'Supersedes'),
        (REFERS_TO, 'Refers to'),
    ]

    from_record = models.ForeignKey('Record', on_delete=models.CASCADE, related_name='relations_out')
    to_record = models.ForeignKey('Record', on_delete=models.CASCADE, related_name='relations_in')
    relation_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=RELATED)
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [['from_record', 'to_record', 'relation_type']]
        constraints = [models.CheckConstraint(check=~models.Q(from_record=models.F('to_record')), name='relation_not_self')]

    def __str__(self):
        return f'{self.from_record_id} {self.relation_type} {self.to_record_id}'


class RecordAttachment(models.Model):
    """An extra file on a record that is not a version of the main file: annexes, enclosures, a PDF copy."""
    ANNEX = 'annex'
    PDF_COPY = 'pdf_copy'
    ROLE_CHOICES = [(ANNEX, 'Annex or enclosure'), (PDF_COPY, 'PDF copy')]

    record = models.ForeignKey('Record', on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='records/attachments/')
    file_name = models.CharField(max_length=500)
    file_size = models.PositiveBigIntegerField()
    mime_type = models.CharField(max_length=100)
    content_hash = models.CharField(max_length=64, db_index=True)
    role = models.CharField(max_length=12, choices=ROLE_CHOICES, default=ANNEX)
    description = models.CharField(max_length=300, blank=True)
    uploaded_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    # Files are never erased: removing one hides it, and it can be restored
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.file_name} on {self.record_id}'


class DocumentTemplate(models.Model):
    """A starting point for a new document: a Word, Excel or PowerPoint file plus the metadata to pre-fill."""
    KIND_CHOICES = [('word', 'Word'), ('excel', 'Excel'), ('powerpoint', 'PowerPoint')]

    name = models.CharField(max_length=150, unique=True)
    description = models.CharField(max_length=300, blank=True)
    kind = models.CharField(max_length=12, choices=KIND_CHOICES, default='word')
    file = models.FileField(upload_to='templates/')
    file_name = models.CharField(max_length=300)
    mime_type = models.CharField(max_length=100)
    document_type = models.CharField(max_length=30, choices=DocumentType.choices, default=DocumentType.OTHER)
    classification_level = models.CharField(max_length=20, choices=ClassificationLevel.choices, default=ClassificationLevel.INTERNAL)
    record_series = models.ForeignKey(RecordSeries, null=True, blank=True, on_delete=models.SET_NULL, related_name='templates')
    # "Minutes - {date}" -> "Minutes - 14 Oct 2026"; also {year}
    title_pattern = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class PermissionRule(models.Model):
    """Automatic access: everyone in a department (or one user) gets the chosen rights on every record that matches.

    Evaluated live, so a record that is filed into a matching series is covered at once and one that moves out
    stops being covered. A rule never reaches above ``max_classification``.
    """
    name = models.CharField(max_length=150)
    description = models.CharField(max_length=300, blank=True)
    department = models.ForeignKey('accounts.Department', null=True, blank=True, on_delete=models.CASCADE, related_name='permission_rules')
    user = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.CASCADE, related_name='permission_rules')
    record_series = models.ForeignKey(RecordSeries, null=True, blank=True, on_delete=models.CASCADE, related_name='permission_rules')
    include_subseries = models.BooleanField(default=True)
    document_type = models.CharField(max_length=30, blank=True)
    max_classification = models.CharField(max_length=20, choices=ClassificationLevel.choices, default=ClassificationLevel.CONFIDENTIAL)
    can_view = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=False)
    can_download = models.BooleanField(default=True)
    can_share = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class MetadataProfile(models.Model):
    """What a record of this document type must have filled in, and which extra fields it carries."""
    document_type = models.CharField(max_length=30, unique=True)
    # Names of core fields that must be filled, e.g. ['originating_ministry', 'document_date']
    required_fields = models.JSONField(default=list, blank=True)
    # [{'key': 'amount', 'label': 'Contract value', 'kind': 'number', 'required': True}, ...]
    custom_fields = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.document_type


class RecordStar(models.Model):
    """Per-user starred / favourite records."""
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='starred_records')
    record = models.ForeignKey(Record, on_delete=models.CASCADE, related_name='stars')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'record']]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user_id} ★ {self.record_id}'


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
