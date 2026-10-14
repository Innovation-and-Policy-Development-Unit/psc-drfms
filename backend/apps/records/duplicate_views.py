"""Warn before a duplicate is saved: the same file already in the registry, or a record with a near-identical title."""
import re

from django.contrib.postgres.search import TrigramSimilarity
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .authorization import viewable_records
from .models import Record, RecordAttachment, RecordVersion

MAX_ITEMS = 50
SIMILAR_MIN = 0.8
HASH_RE = re.compile(r'^[0-9a-f]{64}$')


def _brief(record, **extra):
    return {
        'id': str(record.pk), 'title': record.title, 'reference_number': record.reference_number,
        'document_type': record.document_type, 'classification_level': record.classification_level, **extra,
    }


class CheckDuplicatesView(APIView):
    """POST {items: [{name, sha256}]} -> for each item, records that already hold that exact file or look the same.

    The browser hashes the file itself, so nothing is uploaded just to ask. Only records the user may view are reported.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        items = request.data.get('items') or []
        if not isinstance(items, list):
            return Response({'detail': 'items must be a list.'}, status=400)
        visible = viewable_records(request.user).values('pk')
        results = []
        for index, item in enumerate(items[:MAX_ITEMS]):
            if not isinstance(item, dict):
                continue
            digest = str(item.get('sha256') or '').lower()
            exact_ids, exact = set(), []
            if HASH_RE.match(digest):
                for v in RecordVersion.objects.filter(content_hash=digest, record_id__in=visible).select_related('record')[:5]:
                    if v.record_id not in exact_ids:
                        exact_ids.add(v.record_id)
                        exact.append(_brief(v.record, found_in=f'version {v.version_number}'))
                for a in RecordAttachment.objects.filter(content_hash=digest, removed_at__isnull=True, record_id__in=visible).select_related('record')[:5]:
                    if a.record_id not in exact_ids:
                        exact_ids.add(a.record_id)
                        exact.append(_brief(a.record, found_in='an attachment'))

            stem = re.sub(r'[_\-.]+', ' ', re.sub(r'\.[A-Za-z0-9]{1,5}$', '', str(item.get('name') or ''))).strip()
            similar = []
            if len(stem) >= 6:
                rows = (
                    Record.objects.filter(pk__in=visible).exclude(pk__in=exact_ids)
                    .annotate(sim=TrigramSimilarity('title', stem)).filter(sim__gte=SIMILAR_MIN).order_by('-sim')[:3]
                )
                similar = [_brief(r, similarity=round(float(r.sim), 2)) for r in rows]
            results.append({'index': index, 'exact': exact, 'similar': similar})
        return Response({'results': results})
