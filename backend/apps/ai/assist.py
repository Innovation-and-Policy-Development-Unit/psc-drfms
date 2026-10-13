"""Turns a plain-English request into the search filters the search page already understands."""
from datetime import date

from apps.records.models import ClassificationLevel, DocumentType, Record, RecordSeries

from . import llm
from .analysis import _clamp, _valid_date

SEARCH_LEVEL = 'unclassified'

SEARCH_SYSTEM = (
    'You convert a plain-language request about a records archive into search filters. Answer with a '
    'single JSON object and nothing else. Use null for any filter the request does not state.'
)


def parse_search(user, text):
    """Plain English -> the filters the search page already understands."""
    provider = llm.provider_for(SEARCH_LEVEL)
    if provider is None:
        raise llm.LLMUnavailable('AI is not available')
    ministries = list(
        Record.objects.exclude(originating_ministry='')
        .values_list('originating_ministry', flat=True).distinct()[:80]
    )
    series = list(RecordSeries.objects.filter(is_active=True).values_list('id', 'code', 'name')[:80])
    types = ', '.join(c.value for c in DocumentType)
    levels = ', '.join(c.value for c in ClassificationLevel)
    data = llm.generate_json(
        provider, 'search_parse', SEARCH_SYSTEM,
        f'Today is {date.today().isoformat()}.\n'
        f'Document types: {types}\nClassification levels: {levels}\n'
        f'Ministries: {"; ".join(ministries) or "(none)"}\n'
        'Series (id | code | name):\n' + '\n'.join(f'{i} | {c} | {n}' for i, c, n in series) + '\n\n'
        'Return {"q": "keywords to search for (no filter words)", "document_type": value or null, '
        '"classification_level": value or null, "ministry": a ministry above or null, '
        '"record_series": series id or null, "date_from": "YYYY-MM-DD" or null, "date_to": "YYYY-MM-DD" or null, '
        '"unsupported": ["parts of the request that these filters cannot express, e.g. amounts"]}.\n\n'
        f'Request: {text[:400]}',
        max_tokens=400, user=user,
    )
    filters = {}
    if data.get('document_type') in {c.value for c in DocumentType}:
        filters['document_type'] = data['document_type']
    if data.get('classification_level') in {c.value for c in ClassificationLevel}:
        filters['classification_level'] = data['classification_level']
    if data.get('ministry') in ministries:
        filters['ministry'] = data['ministry']
    if str(data.get('record_series')) in {str(i) for i, _, _ in series}:
        filters['record_series'] = str(data['record_series'])
    for key in ('date_from', 'date_to'):
        d = _valid_date(data.get(key))
        if d:
            filters[key] = d.isoformat()
    q = re.sub(r'\s+', ' ', str(data.get('q') or '')).strip()[:200]
    unsupported = [str(u)[:120] for u in (data.get('unsupported') or [])[:4]]
    return {'q': q, 'filters': filters, 'unsupported': unsupported, 'engine': f'{provider.name}:{provider.model}'}
