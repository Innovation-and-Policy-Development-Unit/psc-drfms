import logging

from celery import shared_task

from . import llm
from .llm import LLMUnavailable

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def analyze_version(self, version_id):
    """Model analysis of a version: metadata, summary, retention series, sensitivity.

    Layered on the on-server heuristics already stored by ``ai_tag_record``: model
    values replace heuristic ones, anything the model did not return is kept.
    """
    from apps.records.models import RecordVersion
    from apps.records.tasks import update_record_search_vector

    from .analysis import add_sensitivity, analyze, apply_autofile, review_status

    version = RecordVersion.objects.select_related('record').filter(pk=version_id).first()
    if version is None or not (version.ocr_text or '').strip():
        return
    record = version.record
    try:
        suggestions, summary, engine = analyze(version)
    except LLMUnavailable as exc:
        logger.warning('AI analysis unavailable for version %s: %s', version_id, exc)
        raise self.retry(exc=exc, countdown=120)

    merged = {**(version.ai_suggestions or {}), **suggestions}
    if 'sensitive_flags' in (version.ai_suggestions or {}) and 'sensitive_flags' not in suggestions:
        merged['sensitive_flags'] = version.ai_suggestions['sensitive_flags']
    filled = apply_autofile(record, merged) if engine else []

    version.ai_suggestions = merged
    version.ai_summary = summary or version.ai_summary
    version.ai_engine = engine
    version.ai_processed = True
    version.ai_review_status = review_status(record, merged, filled)
    version.save(update_fields=['ai_suggestions', 'ai_summary', 'ai_engine', 'ai_processed', 'ai_review_status'])
    if filled:
        update_record_search_vector.delay(str(record.pk))


@shared_task(bind=True, max_retries=2)
def summarize_version(self, version_id):
    from apps.records.models import RecordVersion

    from .analysis import summarize

    version = RecordVersion.objects.select_related('record').filter(pk=version_id).first()
    if version is None or llm.provider_for(version.record.classification_level) is None:
        return
    try:
        summary, engine = summarize(version)
    except LLMUnavailable as exc:
        raise self.retry(exc=exc, countdown=120)
    version.ai_summary = summary
    version.ai_engine = engine
    version.save(update_fields=['ai_summary', 'ai_engine'])
