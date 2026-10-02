import logging

from celery import shared_task

from .embeddings import EmbeddingUnavailable
from .indexing import index_record

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=5)
def embed_record(self, record_id):
    """Refresh a record's semantic-search index. Retries while Ollama is unavailable."""
    try:
        return index_record(record_id)
    except EmbeddingUnavailable as exc:
        logger.warning('Embedding service unavailable for record %s: %s', record_id, exc)
        raise self.retry(exc=exc, countdown=120)
