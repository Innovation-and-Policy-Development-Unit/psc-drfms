"""Meaning-based retrieval over RecordChunk embeddings.

Every query is restricted to records the requesting user may see *before*
anything is returned, so semantic matches can never leak restricted records.
"""
from dataclasses import dataclass

import numpy as np
from django.conf import settings
from pgvector.django import CosineDistance

from apps.records.authorization import viewable_records as visible_records
from apps.records.models import Record

from .embeddings import embed_query
from .models import RecordChunk

TOP_CHUNKS = 60


@dataclass
class Hit:
    similarity: float
    snippet: str


def _best_per_record(chunks, min_similarity):
    hits = {}
    for chunk in chunks:
        sim = 1.0 - float(chunk.distance)
        if sim < min_similarity:
            continue
        if chunk.record_id not in hits or sim > hits[chunk.record_id].similarity:
            hits[chunk.record_id] = Hit(sim, chunk.text)
    return hits


def _nearest(user, vector, exclude_record=None, limit=TOP_CHUNKS):
    qs = RecordChunk.objects.filter(record_id__in=visible_records(user).values('pk'))
    if exclude_record is not None:
        qs = qs.exclude(record_id=exclude_record)
    return list(qs.annotate(distance=CosineDistance('embedding', vector)).order_by('distance')[:limit])


def semantic_hits(user, query):
    """{record_id: Hit} for passages that match the *meaning* of ``query``.

    Empty if the embedding service is unavailable, so callers fall back to
    keyword search without special handling.
    """
    vector = embed_query(query)
    if vector is None:
        return {}
    return _best_per_record(_nearest(user, vector), settings.SEMANTIC_MIN_SIMILARITY)


def similar_records(user, record, limit=6):
    """Records most similar in meaning to ``record``; None if it is not indexed yet."""
    vectors = list(RecordChunk.objects.filter(record=record).values_list('embedding', flat=True))
    if not vectors:
        return None
    centre = np.mean(np.asarray(vectors, dtype=float), axis=0)
    norm = np.linalg.norm(centre)
    if norm == 0:
        return []
    chunks = _nearest(user, (centre / norm).tolist(), exclude_record=record.pk, limit=TOP_CHUNKS * 2)
    hits = _best_per_record(chunks, settings.SEMANTIC_MIN_SIMILARITY)
    ranked = sorted(hits.items(), key=lambda kv: kv[1].similarity, reverse=True)[:limit]
    by_id = {r.pk: r for r in Record.objects.filter(pk__in=[pk for pk, _ in ranked])}
    return [(by_id[pk], hit) for pk, hit in ranked if pk in by_id]
