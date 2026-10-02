"""Turns text into embedding vectors through the configured provider.

Providers (settings.EMBEDDING_PROVIDER):
  * ``gemini`` - Google Gemini API. Text is sent to Google, so callers must
    respect ``may_send_externally`` before indexing a record.
  * ``ollama`` - a local Ollama server; nothing leaves the deployment.

If the provider is down, rate-limited, disabled or misconfigured, callers get
``EmbeddingUnavailable`` and fall back to keyword search.
"""
import hashlib
import json
import logging
import math
import urllib.error
import urllib.request

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

QUERY_CACHE_SECONDS = 600
STATUS_CACHE_SECONDS = 15
GEMINI_BATCH_LIMIT = 100  # requests per batchEmbedContents call


class EmbeddingUnavailable(Exception):
    """The embedding service cannot be used right now."""


def provider():
    return settings.EMBEDDING_PROVIDER.lower()


def is_external():
    """True when text leaves the deployment (anything but a local provider)."""
    return provider() != 'ollama'


def model_name():
    return settings.GEMINI_EMBED_MODEL if provider() == 'gemini' else settings.OLLAMA_EMBED_MODEL


def _post_json(url, payload, timeout, headers=None):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def _normalise(vector):
    norm = math.sqrt(sum(v * v for v in vector))
    return [v / norm for v in vector] if norm else vector


def _embed_gemini(texts, kind):
    key = settings.GEMINI_API_KEY
    if not key:
        raise EmbeddingUnavailable('GEMINI_API_KEY is not set')
    model = settings.GEMINI_EMBED_MODEL
    task = 'RETRIEVAL_QUERY' if kind == 'query' else 'RETRIEVAL_DOCUMENT'
    vectors = []
    for start in range(0, len(texts), GEMINI_BATCH_LIMIT):
        batch = texts[start:start + GEMINI_BATCH_LIMIT]
        payload = {'requests': [
            {
                'model': f'models/{model}',
                'content': {'parts': [{'text': t}]},
                'taskType': task,
                'outputDimensionality': settings.EMBEDDING_DIMENSIONS,
            }
            for t in batch
        ]}
        try:
            data = _post_json(
                f'https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents',
                payload,
                settings.GEMINI_TIMEOUT,
                # Header, not ?key=, so the key never appears in URLs or access logs
                headers={'x-goog-api-key': key},
            )
        except urllib.error.HTTPError as exc:
            reason = 'rate limit reached' if exc.code == 429 else f'HTTP {exc.code}'
            raise EmbeddingUnavailable(f'Gemini: {reason}') from exc
        except (urllib.error.URLError, OSError, ValueError) as exc:
            raise EmbeddingUnavailable(f'Gemini: {exc}') from exc
        items = data.get('embeddings') or []
        if len(items) != len(batch):
            raise EmbeddingUnavailable('Gemini: unexpected response')
        # Dimensions below the model's native size come back un-normalised
        vectors.extend(_normalise(i.get('values') or []) for i in items)
    return vectors


def _embed_ollama(texts):
    try:
        data = _post_json(
            f'{settings.OLLAMA_URL.rstrip("/")}/api/embed',
            {'model': settings.OLLAMA_EMBED_MODEL, 'input': list(texts)},
            settings.OLLAMA_TIMEOUT,
        )
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise EmbeddingUnavailable(f'Ollama: {exc}') from exc
    vectors = data.get('embeddings')
    if not vectors or len(vectors) != len(texts):
        raise EmbeddingUnavailable('Ollama: unexpected response')
    return vectors


def embed_texts(texts, kind='document'):
    """Embed ``texts`` (list of str); ``kind`` is 'document' (passages) or 'query'."""
    if not settings.SEMANTIC_SEARCH_ENABLED:
        raise EmbeddingUnavailable('semantic search is disabled')
    if not texts:
        return []
    if provider() == 'gemini':
        vectors = _embed_gemini(texts, kind)
    elif provider() == 'ollama':
        vectors = _embed_ollama(texts)
    else:
        raise EmbeddingUnavailable(f'unknown provider {settings.EMBEDDING_PROVIDER!r}')
    if any(len(v) != settings.EMBEDDING_DIMENSIONS for v in vectors):
        raise EmbeddingUnavailable(
            f'{model_name()} returned {len(vectors[0])} dimensions, expected {settings.EMBEDDING_DIMENSIONS}'
        )
    return vectors


def embed_query(text):
    """Embed a search query, remembering recent ones. Returns None if unavailable."""
    text = text.strip()
    if not text:
        return None
    key = 'embq:' + hashlib.sha256(f'{provider()}|{model_name()}|{text}'.encode()).hexdigest()
    cached = cache.get(key)
    if cached is not None:
        return cached
    try:
        vector = embed_texts([text], kind='query')[0]
    except EmbeddingUnavailable as exc:
        logger.info('Semantic search skipped: %s', exc)
        return None
    cache.set(key, vector, QUERY_CACHE_SECONDS)
    return vector


def service_status():
    """What the UI and admins need to know about semantic search right now."""
    cached = cache.get('embed_status')
    if cached is not None:
        return cached
    status = {
        'enabled': settings.SEMANTIC_SEARCH_ENABLED,
        'provider': provider(),
        'external': is_external(),
        'model': model_name(),
        'available': False,
        'maxClassification': settings.EMBEDDING_EXTERNAL_MAX_CLASSIFICATION if is_external() else None,
    }
    if settings.SEMANTIC_SEARCH_ENABLED:
        if provider() == 'gemini':
            # Spending quota on a health probe is wasteful; a configured key is enough here.
            status['available'] = bool(settings.GEMINI_API_KEY)
        elif provider() == 'ollama':
            try:
                req = urllib.request.Request(f'{settings.OLLAMA_URL.rstrip("/")}/api/tags')
                with urllib.request.urlopen(req, timeout=3) as resp:
                    names = {m.get('name', '') for m in json.load(resp).get('models', [])}
                wanted = settings.OLLAMA_EMBED_MODEL
                status['available'] = any(n == wanted or n.split(':')[0] == wanted for n in names)
            except (urllib.error.URLError, OSError, ValueError):
                pass
    cache.set('embed_status', status, STATUS_CACHE_SECONDS)
    return status
