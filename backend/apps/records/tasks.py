import logging
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_record_ocr(self, version_id):
    """Extract text from uploaded document using pytesseract."""
    from .models import RecordVersion
    try:
        version = RecordVersion.objects.get(id=version_id)
        file_content = version.file.read()
        mime = version.mime_type.lower()
        text = ''

        if 'pdf' in mime:
            from pdf2image import convert_from_bytes
            import pytesseract
            pages = convert_from_bytes(file_content, dpi=300)
            texts = [pytesseract.image_to_string(p, lang=settings.OCR_LANGUAGES) for p in pages]
            text = '\n\n'.join(texts)
        elif mime.startswith('image/'):
            import pytesseract
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(file_content))
            text = pytesseract.image_to_string(img, lang=settings.OCR_LANGUAGES)

        if text.strip():
            version.ocr_text = text.strip()
        version.ocr_processed = True
        version.save(update_fields=['ocr_text', 'ocr_processed'])

        # Update record search vector
        update_record_search_vector.delay(str(version.record_id))

        # Queue AI tagging if text was extracted
        if text.strip() and settings.ANTHROPIC_API_KEY:
            ai_tag_record.delay(str(version.id))

    except Exception as exc:
        logger.error(f"OCR failed for version {version_id}: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=2)
def ai_tag_record(self, version_id):
    """Use Anthropic API to suggest metadata for a record (transient processing - text not stored by Anthropic)."""
    from .models import RecordVersion
    try:
        version = RecordVersion.objects.get(id=version_id)
        if not version.ocr_text:
            return

        import anthropic
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        prompt = f"""You are a records classification assistant for the Office of the Public Service Commission, Vanuatu.
Analyse the following document text and suggest metadata. Respond in JSON only.

Document text (first 2000 chars):
{version.ocr_text[:2000]}

Return JSON with these fields (include a confidence 0-1 for each):
{{
  "document_type": {{"value": "...", "confidence": 0.0}},
  "originating_ministry": {{"value": "...", "confidence": 0.0}},
  "subject_line": {{"value": "...", "confidence": 0.0}},
  "document_date": {{"value": "YYYY-MM-DD or null", "confidence": 0.0}},
  "reference_number_format": {{"value": "...", "confidence": 0.0}},
  "classification_level": {{"value": "unclassified|internal|confidential|restricted", "confidence": 0.0}}
}}"""

        message = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=512,
            messages=[{'role': 'user', 'content': prompt}],
        )

        import json
        response_text = message.content[0].text
        start = response_text.find('{')
        end = response_text.rfind('}') + 1
        suggestions = json.loads(response_text[start:end])

        version.ai_suggestions = suggestions
        version.ai_processed = True
        version.save(update_fields=['ai_suggestions', 'ai_processed'])

    except Exception as exc:
        logger.error(f"AI tagging failed for version {version_id}: {exc}")
        raise self.retry(exc=exc, countdown=120)


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
                )), 'C')
            WHERE id = %s
        """, [record_id, record_id])


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
