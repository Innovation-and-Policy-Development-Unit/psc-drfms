"""Pull searchable text out of an uploaded file.

Used for attachments (and for Word, Excel, PowerPoint and plain-text main files, which the scanner
used to skip). PDFs use their own text layer first, which is faster and more exact than scanning,
and only pages with no text are scanned with OCR.
"""
import html
import io
import logging
import re
import zipfile

from django.conf import settings

logger = logging.getLogger(__name__)

MAX_OCR_PAGES = 60
TEXT_LAYER_MIN_CHARS = 40       # a PDF page with fewer characters than this is treated as a scan
MAX_MEMBER_BYTES = 20 * 1024 * 1024  # per XML part inside an Office file (zip-bomb guard)
MAX_TEXT_CHARS = 2_000_000

_TAG = re.compile(r'<[^>]+>')
_WORD_TEXT = re.compile(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', re.S)
_SHEET_TEXT = re.compile(r'<t(?:\s[^>]*)?>(.*?)</t>', re.S)
_SLIDE_TEXT = re.compile(r'<a:t(?:\s[^>]*)?>(.*?)</a:t>', re.S)
_SLIDE_NO = re.compile(r'slide(\d+)\.xml$')


def _read(z, name):
    info = z.getinfo(name)
    if info.file_size > MAX_MEMBER_BYTES:
        return ''
    return z.read(name).decode('utf-8', errors='replace')


def _office_text(content, mime, name_hint=''):
    try:
        z = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        return ''
    names = set(z.namelist())
    out = []
    if 'word/document.xml' in names:
        out = [''.join(html.unescape(m) for m in _WORD_TEXT.findall(p)) for p in _read(z, 'word/document.xml').split('</w:p>')]
    elif 'xl/workbook.xml' in names:
        if 'xl/sharedStrings.xml' in names:
            out = [html.unescape(m) for m in _SHEET_TEXT.findall(_read(z, 'xl/sharedStrings.xml'))]
    elif any(n.startswith('ppt/slides/slide') for n in names):
        slides = sorted((n for n in names if _SLIDE_NO.search(n)), key=lambda n: int(_SLIDE_NO.search(n).group(1)))
        out = [' '.join(html.unescape(m) for m in _SLIDE_TEXT.findall(_read(z, n))) for n in slides]
    elif 'content.xml' in names:  # OpenDocument
        out = [html.unescape(_TAG.sub(' ', _read(z, 'content.xml').replace('</text:p>', '\n')))]
    return '\n'.join(line.strip() for line in out if line and line.strip())


def _ocr_image(image):
    import pytesseract
    return pytesseract.image_to_string(image, lang=settings.OCR_LANGUAGES)


def _pdf_text(content):
    import fitz  # PyMuPDF

    parts = []
    with fitz.open(stream=content, filetype='pdf') as doc:
        if doc.needs_pass:
            return ''
        for index, page in enumerate(doc):
            if index >= MAX_OCR_PAGES:
                break
            text = page.get_text().strip()
            if len(text) < TEXT_LAYER_MIN_CHARS:
                try:
                    from PIL import Image
                    pix = page.get_pixmap(dpi=200, alpha=False)
                    scanned = _ocr_image(Image.open(io.BytesIO(pix.tobytes('png')))).strip()
                    text = scanned if len(scanned) > len(text) else text
                except Exception as exc:  # no OCR engine: keep whatever text layer there was
                    logger.info('OCR unavailable for a PDF page: %s', exc)
            parts.append(text)
    return '\n\n'.join(p for p in parts if p)


def extract_text(content, mime_type, file_name=''):
    """Searchable text of ``content`` (bytes), or '' when the type has none or reading fails."""
    mime = (mime_type or '').lower()
    name = (file_name or '').lower()
    try:
        if 'pdf' in mime or name.endswith('.pdf'):
            text = _pdf_text(content)
        elif mime.startswith('image/'):
            from PIL import Image
            text = _ocr_image(Image.open(io.BytesIO(content)))
        elif mime in ('text/plain', 'text/csv') or name.endswith(('.txt', '.csv')):
            text = content.decode('utf-8', errors='replace')
        elif any(k in mime for k in ('wordprocessingml', 'spreadsheetml', 'presentationml', 'opendocument')) or \
                name.endswith(('.docx', '.xlsx', '.pptx', '.odt', '.ods', '.odp')):
            text = _office_text(content, mime, name)
        else:
            text = ''
    except Exception as exc:
        logger.warning('Could not read text from %s: %s', file_name or mime, exc)
        return ''
    return re.sub(r'\n{3,}', '\n\n', text).strip()[:MAX_TEXT_CHARS]
