"""Recycle bin.

Deleting a record moves it here; it stays hidden from every list, search and AI answer until it is
restored. The bin never erases anything: records leave the system only through the
destruction-certificate process, which has approval and an audit trail.
"""
from django.db.models import OuterRef, Subquery
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsRecordsOfficerOrAbove
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .authorization import ensure_record_access, visible_records_q
from .models import Record, RecordVersion

MAX_ROWS = 500
MAX_RESTORE = 200


def _bin_queryset(user):
    """Records in the bin that this user's clearance lets them see."""
    latest = RecordVersion.objects.filter(record=OuterRef('pk')).order_by('-version_number')
    return (
        Record.objects.filter(deleted_at__isnull=False, destruction_certificate__isnull=True)
        .filter(visible_records_q(user))
        .select_related('record_series', 'deleted_by', 'merged_into')
        .annotate(
            file_name=Subquery(latest.values('file_name')[:1]),
            file_size=Subquery(latest.values('file_size')[:1]),
        )
        .distinct()
    )


class RecycleBinView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def get(self, request):
        qs = _bin_queryset(request.user)
        text = request.query_params.get('q', '').strip()[:100]
        if text:
            qs = qs.filter(title__icontains=text) | qs.filter(reference_number__icontains=text)
        total = qs.count()
        rows = [
            {
                'id': str(r.pk),
                'reference_number': r.reference_number,
                'title': r.title,
                'classification_level': r.classification_level,
                'document_type': r.document_type,
                'record_series_name': r.record_series.name if r.record_series else '',
                'file_name': r.file_name or '',
                'file_size': r.file_size or 0,
                'deleted_at': r.deleted_at,
                'deleted_by_name': r.deleted_by.get_full_name() if r.deleted_by else '',
                'merged_into': {'id': str(r.merged_into_id), 'reference_number': r.merged_into.reference_number, 'title': r.merged_into.title} if r.merged_into else None,
            }
            for r in qs.order_by('-deleted_at')[:MAX_ROWS]
        ]
        return Response({'count': total, 'results': rows})


class RestoreFromBinView(APIView):
    """Put records back exactly as they were: series, retention date, tags, versions and history."""
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request):
        ids = request.data.get('record_ids') or []
        if not isinstance(ids, list) or not ids:
            return Response({'detail': 'record_ids is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(ids) > MAX_RESTORE:
            return Response({'detail': f'Restore at most {MAX_RESTORE} records at a time.'}, status=status.HTTP_400_BAD_REQUEST)

        from .tasks import update_record_search_vector

        restored, failed = [], []
        for record in Record.objects.filter(pk__in=ids, deleted_at__isnull=False, destruction_certificate__isnull=True):
            try:
                # Same rule as deleting: you need delete rights over it (and clearance) to bring it back
                ensure_record_access(request.user, record, 'delete', allow_deleted=True)
            except PermissionDenied:
                failed.append({'id': str(record.pk), 'title': record.title, 'detail': 'You do not have permission to restore this record.'})
                continue
            record.destroyed_at = record.deleted_at = record.deleted_by = record.merged_into = None
            # post_save re-queues the semantic index; the keyword index is rebuilt here
            record.save(update_fields=['destroyed_at', 'deleted_at', 'deleted_by', 'merged_into'])
            update_record_search_vector.delay(str(record.pk))
            log_action(request, AuditAction.RESTORE, record)
            restored.append(str(record.pk))

        missing = set(map(str, ids)) - set(restored) - {f['id'] for f in failed}
        failed += [{'id': i, 'title': '', 'detail': 'Not found in the Recycle bin.'} for i in sorted(missing)]
        return Response({'restored': restored, 'failed': failed, 'count': len(restored)})
