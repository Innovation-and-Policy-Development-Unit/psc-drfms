"""Split record text into passages small enough to embed accurately."""
import re

CHUNK_CHARS = 900
OVERLAP_CHARS = 150
MAX_BODY_CHUNKS = 80  # bounds embedding cost for very large documents


def header_text(record):
    """Chunk 0: what a person sees about the record before opening it."""
    parts = [record.title, record.originating_ministry, record.description]
    return '. '.join(p.strip() for p in parts if p and p.strip())


def split_text(text, size=CHUNK_CHARS, overlap=OVERLAP_CHARS, limit=MAX_BODY_CHUNKS):
    """Greedy paragraph packing with a small overlap between neighbours."""
    text = re.sub(r'[ \t]+', ' ', text or '').strip()
    if not text:
        return []
    chunks, current = [], ''
    for para in re.split(r'\n\s*\n|\n', text):
        para = para.strip()
        if not para:
            continue
        # A single paragraph longer than the window is cut on sentence-ish borders
        while len(para) > size:
            cut = max(para.rfind('. ', 0, size), para.rfind(' ', 0, size))
            cut = cut if cut > size // 2 else size
            piece, para = para[:cut + 1].strip(), para[cut + 1:].strip()
            if current:
                chunks.append(current)
                current = ''
            chunks.append(piece)
        if current and len(current) + len(para) + 1 > size:
            chunks.append(current)
            current = current[-overlap:] + ' ' + para if overlap else para
        else:
            current = f'{current} {para}'.strip()
    if current:
        chunks.append(current)
    return chunks[:limit]


def record_passages(record, ocr_text, attachments=()):
    """All passages to index for ``record``: header first, then the body, then each attachment's text.

    ``attachments`` is an iterable of (file name, text); each is labelled so a passage says where it came from.
    """
    passages = []
    header = header_text(record)
    if header:
        passages.append(header)
    body = ocr_text or ''
    for name, text in attachments:
        if text and text.strip():
            body += f'\n\n[Attachment: {name}]\n{text}'
    passages.extend(split_text(body))
    return passages
