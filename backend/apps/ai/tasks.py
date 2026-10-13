"""Background AI jobs.

A version's summary is written once and stored on it. It is rewritten only when
(a) someone asks for a fresh one, or (b) the OCR text it was written from changes.
Re-running analysis never replaces a summary that is still valid.

``run_analysis`` / ``run_summary`` hold the logic and raise ``LLMUnavailable``;
the celery tasks add retries, and mark the summary 'failed' once retries run out.
The ``ai_backfill`` command calls the same functions directly.
"""
import hashlib
import logging

from celery import shared_task

from . import llm
from .llm import LLMUnavailable

logger = logging.getLogger(__name__)


def text_hash(text):
    return hashlib.sha256((text or '').strip().encode()).hexdigest()


def _versions():
    from apps.records.models import RecordVersion
    return RecordVersion.objects.select_related('record')


def summary_is_current(version):
    """True if the stored summary was written from the text the version still has.

    Summaries from before hashes were stored (empty hash) count as current.
    """
    return bool(version.ai_summary) and version.ai_summary_hash in ('', text_hash(version.ocr_text))


def mark_summary_failed(version_id):
    """Retries are exhausted: show 'failed' if there is no summary, else fall back to the old one."""
    from apps.records.models import RecordVersion
    qs = RecordVersion.objects.filter(pk=version_id, ai_summary_status='pending')
    qs.exclude(ai_summary='').update(ai_summary_status='ready')
    qs.filter(ai_summary='').update(ai_summary_status='failed')


def run_analysis(version_id):
    """Metadata, retention, sensitivity and (if missing or stale) the summary of one version."""
    from apps.records.models import RecordVersion
    from apps.records.tasks import update_record_search_vector

    from .analysis import analyze, apply_autofile, review_status

    version = _versions().filter(pk=version_id).first()
    if version is None or not (version.ocr_text or '').strip():
        return
    record = version.record
    keep_summary = summary_is_current(version)
    wants_summary = llm.provider_for(record.classification_level) is not None and not keep_summary
    if wants_summary:
        RecordVersion.objects.filter(pk=version.pk).update(ai_summary_status='pending')

    suggestions, summary, engine = analyze(version)

    merged = {**(version.ai_suggestions or {}), **suggestions}
    if 'sensitive_flags' in (version.ai_suggestions or {}) and 'sensitive_flags' not in suggestions:
        merged['sensitive_flags'] = version.ai_suggestions['sensitive_flags']
    filled = apply_autofile(record, merged) if engine else []

    version.ai_suggestions = merged
    version.ai_processed = True
    version.ai_review_status = review_status(record, merged, filled)
    fields = ['ai_suggestions', 'ai_processed', 'ai_review_status']
    if engine:
        version.ai_engine = engine
        fields.append('ai_engine')
    if keep_summary:
        if not version.ai_summary_hash:  # adopt legacy summaries into hash tracking
            version.ai_summary_hash = text_hash(version.ocr_text)
            fields.append('ai_summary_hash')
    elif summary:
        version.ai_summary = summary
        version.ai_summary_hash = text_hash(version.ocr_text)
        version.ai_summary_status = 'ready'
        fields += ['ai_summary', 'ai_summary_hash', 'ai_summary_status']
    elif wants_summary:  # the model answered but gave no summary
        version.ai_summary_status = 'failed'
        fields.append('ai_summary_status')
    version.save(update_fields=fields)
    if filled:
        update_record_search_vector.delay(str(record.pk))


def run_summary(version_id):
    """Write a fresh summary, replacing any existing one (an explicit request or a backfill)."""
    from apps.records.models import RecordVersion

    from .analysis import summarize

    version = _versions().filter(pk=version_id).first()
    if version is None:
        return
    summary, engine = summarize(version)
    RecordVersion.objects.filter(pk=version.pk).update(
        ai_summary=summary, ai_engine=engine, ai_summary_status='ready',
        ai_summary_hash=text_hash(version.ocr_text),
    )


@shared_task(bind=True, max_retries=3)
def analyze_version(self, version_id):
    try:
        run_analysis(version_id)
    except LLMUnavailable as exc:
        logger.warning('AI analysis unavailable for version %s: %s', version_id, exc)
        if self.request.retries >= self.max_retries:
            mark_summary_failed(version_id)
            return
        raise self.retry(exc=exc, countdown=120)


@shared_task(bind=True, max_retries=2)
def summarize_version(self, version_id):
    version = _versions().filter(pk=version_id).first()
    if version is None or llm.provider_for(version.record.classification_level) is None:
        mark_summary_failed(version_id)
        return
    try:
        run_summary(version_id)
    except LLMUnavailable as exc:
        logger.warning('AI summary unavailable for version %s: %s', version_id, exc)
        if self.request.retries >= self.max_retries:
            mark_summary_failed(version_id)
            return
        raise self.retry(exc=exc, countdown=120)
