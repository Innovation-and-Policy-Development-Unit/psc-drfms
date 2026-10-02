from django.db import models
from pgvector.django import HnswIndex, VectorField


class NoResultSearch(models.Model):
    query = models.CharField(max_length=500, unique=True)
    count = models.PositiveIntegerField(default=1)
    last_searched = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-count']

    def __str__(self):
        return f'"{self.query}" ({self.count} times)'


class RecordChunk(models.Model):
    """A passage of a record's text with its embedding, for semantic search.

    Chunk 0 is always the record header (title, ministry, description); the
    rest are windows over the latest version's OCR text. The embedding model
    and its dimensions are set in settings (OLLAMA_EMBED_MODEL / EMBEDDING_DIMENSIONS).
    """
    record = models.ForeignKey('records.Record', on_delete=models.CASCADE, related_name='chunks')
    chunk_index = models.PositiveIntegerField()
    text = models.TextField()
    # sha256 of `text`: unchanged passages keep their embedding when a record is re-indexed
    text_hash = models.CharField(max_length=64)
    embedding = VectorField(dimensions=1024)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['record_id', 'chunk_index']
        constraints = [
            models.UniqueConstraint(fields=['record', 'chunk_index'], name='uniq_record_chunk_index'),
        ]
        indexes = [
            HnswIndex(
                name='chunk_embedding_hnsw',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ]

    def __str__(self):
        return f'{self.record_id}#{self.chunk_index}'
