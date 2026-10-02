import hashlib
import logging

from django.conf import settings
from django.db import transaction

from apps.records.authorization import CLASSIFICATION_RANK
from apps.records.models import Record

from . import embeddings
from .chunking import record_passages
from .models import RecordChunk

logger = logging.getLogger(__name__)

EMBED_BATCH = 16


def _hash(text):
    return hashlib.sha256(text.encode()).hexdigest()


def may_send_externally(record):
    """Whether this record's text may be sent to the embedding provider.

    A local provider can take anything. An external one (Gemini) only receives
    records at or below EMBEDDING_EXTERNAL_MAX_CLASSIFICATION; an unknown
    setting or classification is treated as the strictest case.
    """
    if not embeddings.is_external():
        return True
    ceiling = CLASSIFICATION_RANK.get(settings.EMBEDDING_EXTERNAL_MAX_CLASSIFICATION, 0)
    return CLASSIFICATION_RANK.get(record.classification_level, 99) <= ceiling


def index_record(record_id):
    """(Re)build the embedding chunks of one record. Returns the chunk count.

    Passages whose text is unchanged keep their stored vector, so editing a
    title re-embeds only the header, not the whole document. Raises
    ``EmbeddingUnavailable`` if the service is down so a task can retry.
    """
    record = Record.objects.filter(pk=record_id, destroyed_at__isnull=True).first()
    if record is None:
        RecordChunk.objects.filter(record_id=record_id).delete()
        return 0

    if not may_send_externally(record):
        # Also covers a record that was reclassified upwards after being indexed
        RecordChunk.objects.filter(record=record).delete()
        return 0

    latest = record.versions.order_by('-version_number').first()
    passages = record_passages(record, latest.ocr_text if latest else '')
    hashes = [_hash(p) for p in passages]

    existing = {c.chunk_index: c for c in RecordChunk.objects.filter(record=record)}
    reusable = {
        i: existing[i].embedding
        for i, h in enumerate(hashes)
        if i in existing and existing[i].text_hash == h
    }
    todo = [i for i in range(len(passages)) if i not in reusable]

    fresh = {}
    for start in range(0, len(todo), EMBED_BATCH):
        batch = todo[start:start + EMBED_BATCH]
        for i, vector in zip(batch, embeddings.embed_texts([passages[i] for i in batch])):
            fresh[i] = vector

    with transaction.atomic():
        RecordChunk.objects.filter(record=record).delete()
        RecordChunk.objects.bulk_create([
            RecordChunk(
                record=record,
                chunk_index=i,
                text=passages[i],
                text_hash=hashes[i],
                embedding=reusable[i] if i in reusable else fresh[i],
            )
            for i in range(len(passages))
        ])
    return len(passages)
