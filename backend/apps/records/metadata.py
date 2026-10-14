"""Metadata cards: which fields a record of each document type must have, and which extra ones it carries.

Configured per document type by an administrator (``MetadataProfile``). Required fields are checked
before a record enters a workflow; the record page shows what is missing.
"""
import re

from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .models import DocumentType, MetadataProfile

# Core fields an administrator can make mandatory
CORE_FIELDS = {
    'description': 'Description',
    'originating_ministry': 'Originating ministry',
    'document_date': 'Document date',
    'received_date': 'Received date',
    'record_series': 'Record series',
    'physical_file_ref': 'Physical file reference',
    'physical_location': 'Physical location',
    'tags': 'Tags',
}
CUSTOM_KINDS = ('text', 'number', 'date')
KEY_RE = re.compile(r'^[a-z][a-z0-9_]{1,39}$')
MAX_CUSTOM_FIELDS = 12
MAX_VALUE_LENGTH = 500


def _filled(record, key):
    value = getattr(record, key, None)
    if key == 'record_series':
        return record.record_series_id is not None
    if isinstance(value, (list, dict)):
        return bool(value)
    return value not in (None, '')


def profile_for(document_type):
    return MetadataProfile.objects.filter(document_type=document_type).first()


def missing_required(record):
    """Required fields (core and custom) this record has not filled in yet."""
    profile = profile_for(record.document_type)
    if profile is None:
        return []
    missing = [
        {'key': key, 'label': CORE_FIELDS[key], 'custom': False}
        for key in profile.required_fields
        if key in CORE_FIELDS and not _filled(record, key)
    ]
    values = record.custom_fields or {}
    missing += [
        {'key': f['key'], 'label': f['label'], 'custom': True}
        for f in profile.custom_fields
        if f.get('required') and str(values.get(f['key'], '')).strip() == ''
    ]
    return missing


def clean_custom_values(value):
    """Validate a record's custom_fields payload: a flat dict of short scalar values."""
    if not isinstance(value, dict):
        raise ValidationError('custom_fields must be an object.')
    if len(value) > MAX_CUSTOM_FIELDS * 2:
        raise ValidationError('Too many custom fields.')
    out = {}
    for key, val in value.items():
        if not isinstance(key, str) or not KEY_RE.match(key):
            raise ValidationError(f'Invalid field name: {key!r}.')
        if isinstance(val, bool) or val is None or isinstance(val, (list, dict)):
            raise ValidationError(f'{key}: use text, a number or a date.')
        text = str(val).strip()
        if len(text) > MAX_VALUE_LENGTH:
            raise ValidationError(f'{key} is too long.')
        out[key] = text
    return out


def _clean_profile(data):
    required = data.get('required_fields') or []
    if not isinstance(required, list) or any(k not in CORE_FIELDS for k in required):
        raise ValidationError({'required_fields': 'Unknown field in the required list.'})
    custom = data.get('custom_fields') or []
    if not isinstance(custom, list) or len(custom) > MAX_CUSTOM_FIELDS:
        raise ValidationError({'custom_fields': f'At most {MAX_CUSTOM_FIELDS} extra fields.'})
    cleaned, seen = [], set()
    for f in custom:
        key = str(f.get('key', '')).strip()
        label = ' '.join(str(f.get('label', '')).split())[:60]
        kind = f.get('kind', 'text')
        if not KEY_RE.match(key) or key in seen or key in CORE_FIELDS:
            raise ValidationError({'custom_fields': f'Invalid or duplicate field name: {key!r}.'})
        if not label or kind not in CUSTOM_KINDS:
            raise ValidationError({'custom_fields': f'{key}: needs a label and a kind (text, number or date).'})
        seen.add(key)
        cleaned.append({'key': key, 'label': label, 'kind': kind, 'required': bool(f.get('required'))})
    return list(dict.fromkeys(required)), cleaned


class MetadataProfilesView(APIView):
    """Everyone may read the profiles (the record page needs them); only administrators change them."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profiles = {p.document_type: {'required_fields': p.required_fields, 'custom_fields': p.custom_fields}
                    for p in MetadataProfile.objects.all()}
        return Response({
            'core_fields': [{'key': k, 'label': v} for k, v in CORE_FIELDS.items()],
            'document_types': [{'value': c.value, 'label': c.label} for c in DocumentType],
            'profiles': profiles,
        })


class MetadataProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def put(self, request, document_type):
        if document_type not in DocumentType.values:
            return Response({'detail': 'Unknown document type.'}, status=status.HTTP_404_NOT_FOUND)
        required, custom = _clean_profile(request.data)
        profile, _ = MetadataProfile.objects.update_or_create(
            document_type=document_type, defaults={'required_fields': required, 'custom_fields': custom},
        )
        log_action(request, AuditAction.UPDATE, extra={'metadata_profile': document_type, 'required': required, 'custom': [f['key'] for f in custom]})
        return Response({'required_fields': profile.required_fields, 'custom_fields': profile.custom_fields})
