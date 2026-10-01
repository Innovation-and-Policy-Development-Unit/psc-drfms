"""
Local (on-server) metadata suggestions for a record.

No text ever leaves the server: suggestions come from keyword scoring and
pattern matching over the OCR text, so they work offline and cost nothing.
Output shape is stable (``{field: {"value": ..., "confidence": 0-1}}``) so a
stronger local model can replace this module later without touching callers.
"""
import re
from collections import Counter
from datetime import date

from .models import DocumentType

# document_type -> weighted keywords (lower-case). Phrases weigh more than words.
_TYPE_KEYWORDS = {
    DocumentType.CONTRACT: {'agreement': 2, 'contract': 3, 'parties': 1, 'hereinafter': 3, 'terms and conditions': 3, 'termination': 1, 'witness whereof': 3},
    DocumentType.FINANCIAL: {'invoice': 3, 'budget': 2, 'expenditure': 2, 'payment': 1, 'vatu': 2, 'purchase order': 3, 'receipt': 2, 'financial statement': 3},
    DocumentType.PERSONNEL_FILE: {'curriculum vitae': 3, 'employee': 1, 'appointment': 2, 'leave application': 3, 'salary': 1, 'probation': 2, 'personnel': 2, 'next of kin': 3},
    DocumentType.DISCIPLINARY: {'disciplinary': 4, 'misconduct': 3, 'suspension': 2, 'show cause': 3, 'allegation': 2, 'breach of': 1},
    DocumentType.BOARD_PAPER: {'board paper': 4, 'commission paper': 4, 'for decision': 2, 'for noting': 2, 'recommendation': 1, 'agenda item': 3},
    DocumentType.SUBMISSION: {'submission': 3, 'commission submission': 4, 'seeking approval': 3, 'purpose of this submission': 4},
    DocumentType.POLICY: {'policy': 3, 'policy statement': 3, 'guidelines': 2, 'scope and application': 3, 'procedure': 1},
    DocumentType.CIRCULAR: {'circular': 4, 'all ministries': 3, 'all directors': 3, 'attention all': 3, 'is hereby notified': 2},
    DocumentType.REPORT: {'annual report': 4, 'executive summary': 3, 'findings': 1, 'conclusions': 1, 'report': 1, 'methodology': 2},
    DocumentType.LEGAL: {'pursuant to': 2, 'act no': 3, 'legal opinion': 4, 'court': 2, 'plaintiff': 3, 'defendant': 3, 'section': 1, 'regulation': 1},
    DocumentType.CORRESPONDENCE: {'dear': 2, 'yours sincerely': 3, 'yours faithfully': 3, 'refer to your letter': 3, 'our ref': 2, 'your ref': 2, 're:': 1},
}

_CLASSIFICATION_KEYWORDS = [
    ('restricted', ('restricted', 'strictly confidential', 'in confidence')),
    ('confidential', ('confidential', 'private and confidential', 'sensitive')),
    ('internal', ('internal use', 'for internal', 'draft')),
]

_MINISTRY_RE = re.compile(
    r'\b(?:Ministry|Department|Office|Commission|Authority)\s+of\s+(?:the\s+)?[A-Z][A-Za-z&,\- ]{3,60}?(?=[\n.,;:]|\s{2,}|$)'
)
_DATE_PATTERNS = [
    (re.compile(r'\b(\d{4})-(\d{2})-(\d{2})\b'), lambda m: (int(m[1]), int(m[2]), int(m[3]))),
    (re.compile(r'\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b'), lambda m: (int(m[3]), int(m[2]), int(m[1]))),
]
_MONTHS = {m: i for i, m in enumerate(
    ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
     'september', 'october', 'november', 'december'], 1)}
_LONG_DATE_RE = re.compile(
    r'\b(\d{1,2})(?:st|nd|rd|th)?\s+(' + '|'.join(_MONTHS) + r')\s+(\d{4})\b', re.IGNORECASE)
_REF_RE = re.compile(r'\b(?:Our\s+)?Ref(?:erence)?\.?\s*(?:No\.?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9/\-.]{3,40})', re.IGNORECASE)


def _valid_date(y, m, d):
    try:
        found = date(y, m, d)
    except ValueError:
        return None
    return found if 1990 <= found.year <= date.today().year + 1 else None


def _find_date(text):
    head = text[:3000]
    for m in _LONG_DATE_RE.finditer(head):
        found = _valid_date(int(m[3]), _MONTHS[m[2].lower()], int(m[1]))
        if found:
            return found
    for pattern, to_ymd in _DATE_PATTERNS:
        for m in pattern.finditer(head):
            found = _valid_date(*to_ymd(m))
            if found:
                return found
    return None


def _score_type(text):
    lower = text.lower()
    scores = Counter()
    for doc_type, words in _TYPE_KEYWORDS.items():
        for word, weight in words.items():
            hits = lower.count(word)
            if hits:
                scores[doc_type] += weight * min(hits, 3)
    if not scores:
        return None, 0.0
    ranked = scores.most_common(2)
    best, best_score = ranked[0]
    runner = ranked[1][1] if len(ranked) > 1 else 0
    if best_score < 4:
        return None, 0.0
    confidence = min(0.95, 0.35 + 0.05 * best_score) * (1.0 if best_score >= 1.5 * runner else 0.75)
    return str(best.value), round(confidence, 2)


def _subject(text):
    for pattern in (r'(?im)^\s*(?:subject|re)\s*[:\-]\s*(.{8,200})$',):
        m = re.search(pattern, text)
        if m:
            return m[1].strip(' *_'), 0.8
    for line in text.splitlines():
        line = line.strip()
        if 12 <= len(line) <= 160 and sum(c.isalpha() for c in line) > 0.6 * len(line):
            return line, 0.4
    return None, 0.0


def suggest_metadata(text, known_ministries=()):
    """Return suggestions for the fields a records officer would otherwise type."""
    text = (text or '').strip()
    if not text:
        return {}

    out = {}

    doc_type, conf = _score_type(text)
    if doc_type:
        out['document_type'] = {'value': doc_type, 'confidence': conf}

    subject, conf = _subject(text)
    if subject:
        out['subject_line'] = {'value': subject, 'confidence': conf}

    ministry = None
    lowered = text[:4000].lower()
    for known in known_ministries:
        if known and known.lower() in lowered:
            ministry = (known, 0.85)
            break
    if not ministry:
        m = _MINISTRY_RE.search(text[:4000])
        if m:
            ministry = (re.sub(r'\s+', ' ', m[0]).strip(), 0.55)
    if ministry:
        out['originating_ministry'] = {'value': ministry[0], 'confidence': ministry[1]}

    found = _find_date(text)
    if found:
        out['document_date'] = {'value': found.isoformat(), 'confidence': 0.6}

    ref = _REF_RE.search(text[:3000])
    if ref:
        out['reference_number_format'] = {'value': ref[1].strip('.'), 'confidence': 0.5}

    lowered = text.lower()
    for level, words in _CLASSIFICATION_KEYWORDS:
        if any(w in lowered for w in words):
            out['classification_level'] = {'value': level, 'confidence': 0.6}
            break

    return out
