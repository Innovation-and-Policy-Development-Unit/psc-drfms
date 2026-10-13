"""On-server detection of personal and sensitive content.

Pure pattern matching, so it works with no AI configured and nothing leaves the
server. The model (when enabled) adds judgement on top; see ``analysis``.

Each flag: ``{category, label, severity, count, example, min_classification}``
where ``example`` is masked so the suggestion list never becomes a second copy
of the data it warns about.
"""
import re

from apps.records.authorization import CLASSIFICATION_RANK

# category -> (label, severity, lowest sensible classification)
CATEGORIES = {
    'financial_account': ('Bank or card number', 'high', 'confidential'),
    'identity_document': ('Identity document number', 'high', 'confidential'),
    'medical': ('Medical information', 'high', 'confidential'),
    'disciplinary': ('Disciplinary or misconduct matter', 'high', 'confidential'),
    'compensation': ('Salary or pay details', 'medium', 'confidential'),
    'personal_data': ('Other personal information', 'medium', 'internal'),
}

_CARD_RE = re.compile(r'(?<!\d)(?:\d[ -]?){13,19}(?!\d)')
_ACCOUNT_RE = re.compile(r'(?i)\b(?:account|acct|iban|bsb)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([0-9][0-9 \-]{6,24}[0-9])')
_IDENTITY_RE = re.compile(
    r'(?i)\b(?:passport|national\s+id|identity\s+card|id\s+card|driver.?s\s+licen[cs]e|tax\s+(?:id|number))'
    r'\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-]{5,19})'
)
_KEYWORDS = {
    'medical': re.compile(
        r'(?i)\b(?:diagnos\w+|medical\s+(?:certificate|report|condition|history)|sick\s+leave|patient|'
        r'hospital\s+admission|prescription|mental\s+health|hiv|pregnan\w+|disabilit\w+|surgery|chronic\s+illness)\b'),
    'disciplinary': re.compile(
        r'(?i)\b(?:disciplinary\s+(?:hearing|action|charge|file)|misconduct|show\s+cause|suspended\s+without\s+pay|'
        r'dismissal|termination\s+for\s+cause|grievance|warning\s+letter)\b'),
    'compensation': re.compile(
        r'(?i)\b(?:salary|remuneration|payslip|pay\s+slip|pay\s+grade|annual\s+package|garnish\w+|allowance\s+of)\b'),
    'personal_data': re.compile(
        r'(?i)\b(?:date\s+of\s+birth|next\s+of\s+kin|home\s+address|marital\s+status|place\s+of\s+birth)\b'),
}


def _luhn(digits):
    total, flip = 0, False
    for ch in reversed(digits):
        d = int(ch)
        if flip:
            d = d * 2 - 9 if d * 2 > 9 else d * 2
        total += d
        flip = not flip
    return total % 10 == 0


def _mask(value):
    value = re.sub(r'\s', '', value)
    return ('•' * max(len(value) - 4, 0)) + value[-4:]


def _flag(category, count, example=''):
    label, severity, minimum = CATEGORIES[category]
    return {
        'category': category, 'label': label, 'severity': severity,
        'count': count, 'example': example, 'min_classification': minimum,
    }


def detect_sensitive(text):
    """Flags found in ``text``; empty list when nothing sensitive is present."""
    text = text or ''
    if not text.strip():
        return []
    flags = []

    cards = [m[0] for m in _CARD_RE.finditer(text)
             if _luhn(re.sub(r'\D', '', m[0])) and 13 <= len(re.sub(r'\D', '', m[0])) <= 19]
    accounts = [m[1] for m in _ACCOUNT_RE.finditer(text)]
    numbers = cards + accounts
    if numbers:
        flags.append(_flag('financial_account', len(numbers), _mask(numbers[0])))

    ids = [m[1] for m in _IDENTITY_RE.finditer(text)]
    if ids:
        flags.append(_flag('identity_document', len(ids), _mask(ids[0])))

    for category, pattern in _KEYWORDS.items():
        found = pattern.findall(text)
        # One passing mention is noise; compensation/personal data need a little more
        threshold = 1 if category in ('medical', 'disciplinary') else 2
        if len(found) >= threshold:
            flags.append(_flag(category, len(found), found[0].lower()))
    return flags


def merge_flags(*lists):
    """Combine flag lists, one entry per category (higher count/severity wins)."""
    merged = {}
    for flags in lists:
        for f in flags:
            cur = merged.get(f['category'])
            if cur is None or (f.get('count') or 0) > (cur.get('count') or 0):
                merged[f['category']] = f
    return list(merged.values())


def minimum_classification(flags):
    """Lowest classification that suits the strictest flag, or None."""
    best = None
    for f in flags:
        level = f.get('min_classification')
        if level and (best is None or CLASSIFICATION_RANK.get(level, 0) > CLASSIFICATION_RANK.get(best, 0)):
            best = level
    return best
