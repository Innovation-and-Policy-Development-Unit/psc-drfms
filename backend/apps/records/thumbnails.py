"""First-page thumbnails for the file browser.

Rendered lazily the first time someone asks for one, then stored on the version so
every later request is a plain file read. PDFs and images only; anything else (Office
files, archives, email) has no thumbnail and the browser shows its type icon.
"""
import io
import logging

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

WIDTH = 360                     # px; fits a grid tile and the details pane on retina screens
MAX_SOURCE_BYTES = 60 * 1024 * 1024
JPEG_QUALITY = 80


def supports(mime_type):
    mime = (mime_type or '').lower()
    return 'pdf' in mime or mime.startswith('image/')


def _from_pdf(data):
    import fitz  # PyMuPDF

    with fitz.open(stream=data, filetype='pdf') as doc:
        if doc.needs_pass or doc.page_count == 0:
            raise ValueError('encrypted or empty PDF')
        page = doc[0]
        zoom = WIDTH / max(page.rect.width, 1)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        return pix.tobytes('png')


def _jpeg(png_or_image_bytes):
    from PIL import Image

    img = Image.open(io.BytesIO(png_or_image_bytes))
    img.seek(0)  # first frame of multi-page TIFF / animated GIF
    img = img.convert('RGB')
    img.thumbnail((WIDTH, WIDTH * 2))
    out = io.BytesIO()
    img.save(out, format='JPEG', quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


def thumbnail_bytes(version):
    """JPEG bytes for ``version``'s first page, rendering and storing it on first use.

    Returns None when this kind of file has no thumbnail or rendering failed (the
    failure is remembered so a broken file is not retried on every page load).
    """
    if version.thumbnail_failed or not supports(version.mime_type):
        return None
    if version.thumbnail:
        try:
            with version.thumbnail.open('rb') as fh:
                return fh.read()
        except OSError:
            logger.warning('Stored thumbnail for version %s is unreadable; re-rendering', version.pk)

    if version.file_size and version.file_size > MAX_SOURCE_BYTES:
        return None
    try:
        with version.file.open('rb') as fh:
            data = fh.read()
        raw = _from_pdf(data) if 'pdf' in version.mime_type.lower() else data
        jpeg = _jpeg(raw)
    except Exception as exc:  # corrupt, encrypted or unsupported: show the icon instead
        logger.info('No thumbnail for version %s: %s', version.pk, exc)
        type(version).objects.filter(pk=version.pk).update(thumbnail_failed=True)
        return None
    version.thumbnail.save(f'{version.pk}.jpg', ContentFile(jpeg), save=False)
    type(version).objects.filter(pk=version.pk).update(thumbnail=version.thumbnail.name)
    return jpeg
