"""Destruction of records under an approved destruction certificate.

Lifecycle:  disposition review approved ("destroy")  ->  certificate requested (records linked)
            ->  a *different* person approves  ->  ``execute_destruction``  ->  certificate PDF, status "completed".

What execution does to each record (the "metadata stub"):
  * erased:   every version file and thumbnail, attachment files and thumbnails, the QR code, OCR/AI text,
              the search vector, the semantic-search passages (embeddings), and comment text; shared links
              are switched off; description, tags and custom fields are cleared;
  * kept:     the record's reference number, title, classification, series, dates, the version rows with
              their file names, sizes and SHA-256 hashes, and the whole audit trail (a ``destroy`` entry is added).

It refuses (leaving the certificate "approved" so it can be resolved) when any record is on legal hold,
is in an open workflow, or has since been deleted to the Recycle bin.

Backups made before execution still contain the content; see the retention note for backup copies in the README.
"""
import io
import logging

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditAction
from apps.audit.utils import log_system_action

logger = logging.getLogger(__name__)

OPEN_WORKFLOW_STATUSES = ('pending', 'in_progress')


def blocker_for_request(record):
    """Why this record cannot be put on a destruction certificate, or None."""
    from apps.compliance.models import DispositionReview

    if record.erased_at:
        return 'it has already been destroyed'
    if record.deleted_at or record.destroyed_at:
        return 'it is in the Recycle bin'
    if record.destruction_certificate_id:
        return 'it is already on another destruction certificate'
    if record.is_on_legal_hold:
        return 'it is under legal hold'
    if record.is_vital:
        return 'it is a vital record'
    if record.workflows.filter(status__in=OPEN_WORKFLOW_STATUSES).exists():
        return 'it is in an open workflow'
    approved = DispositionReview.objects.filter(record=record, status='approved', proposed_action='destroy')
    if not approved.exists():
        return 'it has no approved disposition review for destruction'
    return None


def blocker_for_execution(record):
    """Why an already-approved destruction cannot run for this record right now, or None."""
    if record.erased_at:
        return None
    if record.deleted_at or record.destroyed_at:
        return 'it is in the Recycle bin'
    if record.is_on_legal_hold or record.legal_holds.filter(is_active=True).exists():
        return 'it is under legal hold'
    if record.workflows.filter(status__in=OPEN_WORKFLOW_STATUSES).exists():
        return 'it is in an open workflow'
    return None


def _erase_record(record, cert, now):
    """Database side of destroying one record. Returns the storage names to delete once this commits."""
    from apps.collaboration.models import Comment
    from apps.records.models import Record, RecordAttachment, RecordVersion
    from apps.search.models import RecordChunk
    from apps.sharing.models import SharedLink

    names = []
    final_hashes = []
    for version in record.versions.all():
        names += [n for n in (version.file.name, version.thumbnail.name) if n]
        final_hashes.append({'version': version.version_number, 'sha256': version.content_hash})
    RecordVersion.objects.filter(record=record).update(
        file='', thumbnail='', ocr_text='', ai_suggestions={}, ai_summary='',
        ai_summary_status='', ai_summary_hash='', ai_review_status='', signature_info={},
    )
    for attachment in record.attachments.all():
        names += [n for n in (attachment.file.name, attachment.thumbnail.name) if n]
    RecordAttachment.objects.filter(record=record).update(file='', thumbnail='', ocr_text='')
    if record.qr_code:
        names.append(record.qr_code.name)

    chunks = RecordChunk.objects.filter(record=record).count()
    RecordChunk.objects.filter(record=record).delete()
    links = SharedLink.objects.filter(record=record, is_active=True).update(is_active=False)
    Comment.objects.filter(record=record).update(
        body=f'[Removed: record destroyed under certificate {cert.certificate_number}]', deleted_at=now,
    )
    Record.objects.filter(pk=record.pk).update(
        description='', tags=[], custom_fields={}, search_vector=None, qr_code='',
        destroyed_at=now, erased_at=now, updated_at=now,
    )
    log_system_action(
        AuditAction.DESTROY, record=record, user=cert.approved_by,
        extra={
            'event': 'record_destroyed',
            'certificate': cert.certificate_number,
            'authorised_by': cert.authorised_by.email if cert.authorised_by else '',
            'approved_by': cert.approved_by.email if cert.approved_by else '',
            'method': cert.destruction_method,
            'versions_erased': len(final_hashes),
            'version_hashes': final_hashes,
            'search_passages_removed': chunks,
            'share_links_disabled': links,
        },
    )
    return names


def _delete_files(names):
    for name in names:
        try:
            default_storage.delete(name)
        except Exception:  # a missing or locked file must not undo the rest
            logger.exception('Could not delete %s while executing a destruction', name)


def build_certificate_pdf(cert):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    def who(user):
        return f'{user.get_full_name()} ({user.email})' if user else 'n/a'

    def when(value):
        return value.strftime('%d %B %Y %H:%M') if value else 'n/a'

    styles = getSampleStyleSheet()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f'Destruction certificate {cert.certificate_number}')
    story = [
        Paragraph('Certificate of Destruction', styles['Title']),
        Paragraph(f'Certificate number <b>{cert.certificate_number}</b>', styles['Heading3']),
        Spacer(1, 6 * mm),
    ]
    details = [
        ['Authorised by', who(cert.authorised_by)],
        ['Approved by', who(cert.approved_by)],
        ['Requested', when(cert.created_at)],
        ['Approved', when(cert.approved_at)],
        ['Carried out', when(cert.completed_at)],
        ['Method', cert.destruction_method],
        ['Notes', cert.notes or '-'],
    ]
    table = Table(details, colWidths=[40 * mm, 130 * mm])
    table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.lightgrey),
    ]))
    story += [table, Spacer(1, 8 * mm), Paragraph('Records destroyed', styles['Heading3'])]

    rows = [['Reference', 'Title', 'Series', 'Classification', 'Retention date']]
    for record in cert.destroyed_records.select_related('record_series').order_by('reference_number'):
        rows.append([
            record.reference_number, Paragraph(record.title, styles['BodyText']),
            record.record_series.code if record.record_series else '-',
            record.classification_level.title(),
            record.retention_date.strftime('%d %b %Y') if record.retention_date else '-',
        ])
    records_table = Table(rows, colWidths=[34 * mm, 62 * mm, 20 * mm, 28 * mm, 28 * mm], repeatRows=1)
    records_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e8ecf1')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.lightgrey),
    ]))
    story += [
        records_table, Spacer(1, 8 * mm),
        Paragraph(
            'The content of the records listed above, including every stored file, attachment, extracted text '
            'and search index entry, has been permanently erased. The reference number, title and audit history '
            'of each record are retained as evidence that it existed and was lawfully disposed of.',
            styles['BodyText'],
        ),
    ]
    doc.build(story)
    return buf.getvalue()


def execute_destruction(cert_id):
    """Carry out an approved certificate. Safe to call again: finished records are skipped.

    Returns ``(outcome, detail)`` where outcome is ``'completed'``, ``'blocked'`` or ``'skipped'``.
    """
    from apps.compliance.models import DestructionCertificate
    from apps.records.models import Record

    files = []
    with transaction.atomic():
        cert = (
            DestructionCertificate.objects.select_for_update(of=('self',))
            .select_related('authorised_by', 'approved_by').filter(pk=cert_id).first()
        )
        if cert is None or cert.status != 'approved':
            return 'skipped', 'The certificate is not approved.'
        if not cert.approved_by_id or cert.approved_by_id == cert.authorised_by_id:
            return 'skipped', 'The certificate does not have an independent approver.'

        records = list(Record.objects.select_for_update().filter(destruction_certificate=cert))
        blockers = {r.reference_number: blocker_for_execution(r) for r in records}
        blockers = {ref: why for ref, why in blockers.items() if why}
        if blockers:
            log_system_action(AuditAction.DESTROY, user=cert.approved_by, extra={
                'event': 'destruction_blocked', 'certificate': cert.certificate_number, 'blockers': blockers,
            })
            return 'blocked', blockers

        now = timezone.now()
        for record in records:
            if not record.erased_at:
                files += _erase_record(record, cert, now)
    _delete_files(files)

    cert.refresh_from_db()
    cert.completed_at = timezone.now()
    pdf = build_certificate_pdf(cert)
    cert.pdf_file.save(f'{cert.certificate_number}.pdf', ContentFile(pdf), save=False)
    cert.status = 'completed'
    cert.save(update_fields=['status', 'completed_at', 'pdf_file'])
    log_system_action(AuditAction.DESTROY, user=cert.approved_by, extra={
        'event': 'destruction_completed', 'certificate': cert.certificate_number, 'records': len(records),
    })
    _notify(cert, len(records))
    return 'completed', len(records)


def _notify(cert, count):
    from apps.notifications.utils import send_notification

    for user in {cert.authorised_by, cert.approved_by}:
        if not user:
            continue
        try:
            send_notification(
                user_id=user.id, title='Destruction completed',
                message=f'Certificate {cert.certificate_number}: {count} record(s) destroyed.',
                notification_type='info', related_url='/compliance/destruction',
            )
        except Exception:
            logger.exception('Could not send destruction notification')
