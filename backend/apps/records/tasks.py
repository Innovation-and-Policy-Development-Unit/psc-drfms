import logging
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


MIN_CHARS_PER_PAGE = 40  # below this a page is treated as unreadable by Tesseract


def _vision_fallback(version, text, images):
    """Re-read scans Tesseract could not (handwriting, poor quality) with a vision model.

    Respects the classification gate; any failure keeps the Tesseract text.
    """
    from django.conf import settings as dj
    if not images or not dj.AI_VISION_OCR_ENABLED or len(text.strip()) >= MIN_CHARS_PER_PAGE * len(images):
        return text
    try:
        from apps.ai.vision import transcribe_pages
        better = transcribe_pages(version.record, images[:dj.AI_VISION_OCR_MAX_PAGES])
    except Exception as exc:  # AI is optional; never fail OCR because of it
        logger.info('Vision OCR skipped for version %s: %s', version.id, exc)
        return text
    return better if len(better.strip()) > len(text.strip()) else text


@shared_task(bind=True, max_retries=3)
def process_record_ocr(self, version_id):
    """Extract text from uploaded document using pytesseract."""
    from .models import RecordVersion
    try:
        version = RecordVersion.objects.get(id=version_id)
        file_content = version.file.read()
        mime = version.mime_type.lower()
        text = ''

        images = []  # PIL page images, kept so a vision model can retry unreadable scans
        if 'pdf' in mime:
            from pdf2image import convert_from_bytes
            import pytesseract
            pages = convert_from_bytes(file_content, dpi=300)
            texts = [pytesseract.image_to_string(p, lang=settings.OCR_LANGUAGES) for p in pages]
            text = '\n\n'.join(texts)
            images = pages
        elif mime.startswith('image/'):
            import pytesseract
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(file_content))
            text = pytesseract.image_to_string(img, lang=settings.OCR_LANGUAGES)
            images = [img]
        else:
            # Word, Excel, PowerPoint and plain text carry their text inside the file
            from .textextract import extract_text
            text = extract_text(file_content, mime, version.file_name)

        text = _vision_fallback(version, text, images)

        if text.strip():
            version.ocr_text = text.strip()
        version.ocr_processed = True
        version.save(update_fields=['ocr_text', 'ocr_processed'])

        # Update record search vector
        update_record_search_vector.delay(str(version.record_id))

        # Semantic index: embed the freshly extracted text
        from apps.search.tasks import embed_record
        embed_record.delay(str(version.record_id))

        # Queue local metadata suggestions if text was extracted
        if text.strip():
            ai_tag_record.delay(str(version.id))

    except Exception as exc:
        logger.error(f"OCR failed for version {version_id}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task
def ai_tag_record(version_id):
    """Suggest metadata from the OCR text using the on-server heuristic suggester.

    This first pass runs entirely locally. The model-based pass (apps.ai) follows and
    only ever sends text that the classification gate permits.
    """
    from .models import Record, RecordVersion
    from .suggest import suggest_metadata

    version = RecordVersion.objects.get(id=version_id)
    if not version.ocr_text:
        return

    ministries = list(
        Record.objects.exclude(originating_ministry="")
        .values_list("originating_ministry", flat=True)
        .distinct()[:200]
    )
    version.ai_suggestions = suggest_metadata(version.ocr_text, ministries)
    version.ai_processed = True
    version.save(update_fields=["ai_suggestions", "ai_processed"])

    # Second pass: retention series, sensitive-data flags and (when a model is
    # configured and permitted for this classification) richer extraction + summary.
    from apps.ai.tasks import analyze_version
    analyze_version.delay(str(version.id))


@shared_task
def update_record_search_vector(record_id):
    """Rebuild the PostgreSQL full-text search vector for a record."""
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE records_record
            SET search_vector =
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(
                    (SELECT string_agg(ocr_text, ' ') FROM records_recordversion WHERE record_id = %s), ''
                ) || ' ' || coalesce(
                    (SELECT string_agg(ocr_text, ' ') FROM records_recordattachment WHERE record_id = %s AND removed_at IS NULL), ''
                )), 'C')
            WHERE id = %s
        """, [record_id, record_id, record_id])


@shared_task
def generate_qr_code(record_id):
    """Generate QR code for a physical record."""
    from .models import Record
    from django.conf import settings
    import qrcode, io
    from django.core.files.base import ContentFile

    record = Record.objects.get(id=record_id)
    url = f"{settings.QR_CODE_BASE_URL}/records/{record.id}"
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    record.qr_code.save(f"qr_{record.reference_number}.png", ContentFile(buf.read()), save=True)


@shared_task
def check_duplicate_on_upload(version_id):
    """Alert if uploaded file hash matches an existing version."""
    from .models import RecordVersion
    version = RecordVersion.objects.get(id=version_id)
    duplicates = RecordVersion.objects.filter(
        content_hash=version.content_hash
    ).exclude(id=version_id).select_related('record')

    if duplicates.exists():
        from apps.notifications.utils import send_notification
        dup_refs = ', '.join(d.record.reference_number for d in duplicates[:5])
        send_notification(
            user_id=version.created_by_id,
            title='Potential Duplicate Detected',
            message=f'Uploaded file matches existing record(s): {dup_refs}',
            notification_type='warning',
            related_record_id=str(version.record_id),
        )


def refresh_record_index(record_id):
    """Rebuild a record's keyword search entry and queue its semantic (AI) index after its attachments changed."""
    update_record_search_vector.delay(str(record_id))
    from django.conf import settings as dj
    if dj.SEMANTIC_SEARCH_ENABLED:
        from apps.search.tasks import embed_record
        embed_record.delay(str(record_id))


@shared_task(bind=True, max_retries=2)
def process_attachment_text(self, attachment_id):
    """Read the text of an attachment so that searching, and the AI, can find what is inside it."""
    from .models import RecordAttachment
    from .textextract import extract_text

    att = RecordAttachment.objects.filter(pk=attachment_id).first()
    if att is None:
        return
    try:
        with att.file.open('rb') as fh:
            content = fh.read()
        att.ocr_text = extract_text(content, att.mime_type, att.file_name)
    except Exception as exc:
        logger.error('Reading attachment %s failed: %s', attachment_id, exc)
        raise self.retry(exc=exc, countdown=60)
    att.ocr_processed = True
    att.save(update_fields=['ocr_text', 'ocr_processed'])
    refresh_record_index(att.record_id)
