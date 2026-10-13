"""One door to whichever language model the deployment chose.

Providers (settings.LLM_PROVIDER / LLM_LOCAL_PROVIDER): ``anthropic``, ``gemini``
(both send text to the vendor) and ``ollama`` (a server you run; nothing leaves).

Classification gate: an external provider only ever sees text from records at or
below LLM_EXTERNAL_MAX_CLASSIFICATION. Anything above goes to the local provider
if one is configured, otherwise it gets no AI at all. Callers ask
``provider_for(level)`` and treat ``None`` as "AI not allowed for this".
"""
import base64
import json
import logging
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

from django.conf import settings

from apps.records.authorization import CLASSIFICATION_RANK

logger = logging.getLogger(__name__)

EXTERNAL = {'anthropic', 'gemini'}


class LLMUnavailable(Exception):
    """The model cannot be used right now (not configured, down, rate limited)."""


@dataclass(frozen=True)
class Provider:
    name: str
    model: str

    @property
    def external(self):
        return self.name in EXTERNAL

    @property
    def vision(self):
        return self.name in EXTERNAL or bool(settings.OLLAMA_VISION_MODEL)

    def describe(self):
        return {'provider': self.name, 'model': self.model, 'external': self.external}


def _build(name):
    name = (name or 'none').strip().lower()
    if name == 'anthropic' and settings.ANTHROPIC_API_KEY:
        return Provider('anthropic', settings.ANTHROPIC_MODEL)
    if name == 'gemini' and settings.GEMINI_API_KEY:
        return Provider('gemini', settings.GEMINI_LLM_MODEL)
    if name == 'ollama':
        return Provider('ollama', settings.OLLAMA_LLM_MODEL)
    return None


def primary():
    return _build(settings.LLM_PROVIDER)


def local():
    p = _build(settings.LLM_LOCAL_PROVIDER)
    return p if p and not p.external else None


def is_enabled():
    return primary() is not None or local() is not None


def _ceiling():
    return CLASSIFICATION_RANK.get(settings.LLM_EXTERNAL_MAX_CLASSIFICATION, 0)


def provider_for(level):
    """The provider allowed to read text of this classification, or None."""
    rank = CLASSIFICATION_RANK.get(level, 99)  # unknown level = strictest
    for p in (primary(), local()):
        if p is not None and (not p.external or rank <= _ceiling()):
            return p
    return None


def provider_for_levels(levels):
    """Provider that may read text drawn from records of all of these classifications."""
    levels = list(levels)
    if not levels:
        return provider_for('unclassified')
    return provider_for(max(levels, key=lambda lv: CLASSIFICATION_RANK.get(lv, 99)))


def status():
    p, loc = primary(), local()
    return {
        'enabled': p is not None or loc is not None,
        'primary': p.describe() if p else None,
        'local': loc.describe() if loc else None,
        'external_max_classification': settings.LLM_EXTERNAL_MAX_CLASSIFICATION if p and p.external else None,
        'vision_ocr': bool(settings.AI_VISION_OCR_ENABLED and any(x and x.vision for x in (p, loc))),
    }


# ---- transport -------------------------------------------------------------

def _post(url, payload, headers=None):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.LLM_TIMEOUT) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        reason = 'rate limit reached' if exc.code == 429 else f'HTTP {exc.code}'
        raise LLMUnavailable(reason) from exc
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise LLMUnavailable(str(exc)[:200]) from exc


def _b64(data):
    return base64.b64encode(data).decode()


def _anthropic(p, system, messages, images, json_mode, max_tokens):
    msgs = []
    for i, m in enumerate(messages):
        content = [{'type': 'text', 'text': m['content']}]
        if images and i == len(messages) - 1:
            content = [
                {'type': 'image', 'source': {'type': 'base64', 'media_type': mt, 'data': _b64(raw)}}
                for mt, raw in images
            ] + content
        msgs.append({'role': m['role'], 'content': content})
    data = _post(
        'https://api.anthropic.com/v1/messages',
        {'model': p.model, 'max_tokens': max_tokens, 'system': system, 'messages': msgs},
        {'x-api-key': settings.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01'},
    )
    return ''.join(b.get('text', '') for b in data.get('content', []) if b.get('type') == 'text')


def _gemini(p, system, messages, images, json_mode, max_tokens):
    contents = []
    for i, m in enumerate(messages):
        parts = [{'text': m['content']}]
        if images and i == len(messages) - 1:
            parts = [{'inlineData': {'mimeType': mt, 'data': _b64(raw)}} for mt, raw in images] + parts
        contents.append({'role': 'model' if m['role'] == 'assistant' else 'user', 'parts': parts})
    gen = {'maxOutputTokens': max_tokens}
    # Reasoning tokens count against maxOutputTokens and can leave nothing for the answer
    if settings.GEMINI_THINKING_BUDGET >= 0:
        gen['thinkingConfig'] = {'thinkingBudget': settings.GEMINI_THINKING_BUDGET}
    if json_mode:
        gen['responseMimeType'] = 'application/json'
    data = _post(
        f'https://generativelanguage.googleapis.com/v1beta/models/{p.model}:generateContent',
        {'systemInstruction': {'parts': [{'text': system}]}, 'contents': contents, 'generationConfig': gen},
        {'x-goog-api-key': settings.GEMINI_API_KEY},
    )
    cands = data.get('candidates') or []
    if not cands:
        raise LLMUnavailable('Gemini returned no answer')
    return ''.join(part.get('text', '') for part in cands[0].get('content', {}).get('parts', []))


def _ollama(p, system, messages, images, json_mode, max_tokens):
    model = settings.OLLAMA_VISION_MODEL if images and settings.OLLAMA_VISION_MODEL else p.model
    msgs = [{'role': 'system', 'content': system}]
    for i, m in enumerate(messages):
        item = {'role': m['role'], 'content': m['content']}
        if images and i == len(messages) - 1:
            item['images'] = [_b64(raw) for _, raw in images]
        msgs.append(item)
    payload = {'model': model, 'messages': msgs, 'stream': False, 'options': {'num_predict': max_tokens}}
    if json_mode:
        payload['format'] = 'json'
    data = _post(f'{settings.OLLAMA_URL.rstrip("/")}/api/chat', payload)
    return (data.get('message') or {}).get('content', '')


def generate(provider, feature, system, prompt=None, messages=None, images=None,
             json_mode=False, max_tokens=1500, user=None, record=None):
    """Send one request and return the model's text. Raises LLMUnavailable.

    ``images`` is a list of (mime_type, bytes). Every call is logged (sizes only,
    never content) so an administrator can see what was sent where.
    """
    from .models import AiCallLog

    if provider is None:
        raise LLMUnavailable('AI is not available for this content')
    messages = messages or [{'role': 'user', 'content': prompt or ''}]
    started = time.monotonic()
    error = ''
    try:
        text = globals()[f'_{provider.name}'](provider, system, messages, images, json_mode, max_tokens)
        if not text.strip():
            raise LLMUnavailable('empty answer')
        return text.strip()
    except LLMUnavailable as exc:
        error = str(exc)[:300]
        raise
    finally:
        try:
            AiCallLog.objects.create(
                user=user if getattr(user, 'is_authenticated', False) else None,
                feature=feature, provider=provider.name, model=provider.model,
                external=provider.external, record=record, ok=not error, error=error,
                prompt_chars=sum(len(m['content']) for m in messages) + len(system),
                duration_ms=int((time.monotonic() - started) * 1000),
            )
        except Exception:  # logging must never break the feature
            logger.exception('Could not write AI call log')


_FENCE = re.compile(r'^```(?:json)?\s*|\s*```$', re.IGNORECASE)


def parse_json(text):
    """Best-effort JSON object from a model answer (tolerates code fences and chatter)."""
    text = _FENCE.sub('', text.strip())
    try:
        value = json.loads(text)
    except ValueError:
        start, end = text.find('{'), text.rfind('}')
        if start == -1 or end <= start:
            raise LLMUnavailable('model did not return JSON')
        try:
            value = json.loads(text[start:end + 1])
        except ValueError as exc:
            raise LLMUnavailable('model returned malformed JSON') from exc
    if not isinstance(value, dict):
        raise LLMUnavailable('model did not return a JSON object')
    return value


def generate_json(provider, feature, system, prompt, **kwargs):
    return parse_json(generate(provider, feature, system, prompt=prompt, json_mode=True, **kwargs))
