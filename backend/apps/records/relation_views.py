"""Relationships between records: replies, superseding versions, references, plain "related"."""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .authorization import ensure_record_access, viewable_records
from .models import Record, RecordRelation

LABELS = dict(RecordRelation.TYPE_CHOICES)
# How the link reads from the other record's side
INVERSE_LABELS = {
    RecordRelation.RELATED: 'Related to',
    RecordRelation.REPLIES_TO: 'Replied to by',
    RecordRelation.SUPERSEDES: 'Superseded by',
    RecordRelation.REFERS_TO: 'Referred to by',
}


def _summary(r):
    return {
        'id': str(r.pk), 'title': r.title, 'reference_number': r.reference_number,
        'document_type': r.document_type, 'classification_level': r.classification_level,
    }


def relations_for(user, record):
    """Links to and from `record`, limited to records the user may view."""
    visible = set(viewable_records(user).values_list('pk', flat=True))
    rows = []
    qs = RecordRelation.objects.filter(Q(from_record=record) | Q(to_record=record)).select_related('from_record', 'to_record', 'created_by')
    for rel in qs:
        outgoing = rel.from_record_id == record.pk
        other = rel.to_record if outgoing else rel.from_record
        if other.pk not in visible:
            continue
        symmetric = rel.relation_type == RecordRelation.RELATED
        rows.append({
            'id': rel.pk,
            'direction': 'out' if outgoing or symmetric else 'in',
            'relation_type': rel.relation_type,
            'label': LABELS[rel.relation_type] if (outgoing or symmetric) else INVERSE_LABELS[rel.relation_type],
            'note': rel.note,
            'record': _summary(other),
            'created_by_name': rel.created_by.get_full_name() if rel.created_by else '',
            'created_at': rel.created_at,
        })
    return rows


class RecordRelationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _record(self, request, pk, action):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, action)
        return record

    def get(self, request, pk):
        record = self._record(request, pk, 'view')
        return Response({'results': relations_for(request.user, record)})

    def post(self, request, pk):
        record = self._record(request, pk, 'edit')
        target = get_object_or_404(viewable_records(request.user), pk=request.data.get('target'))
        rel_type = request.data.get('relation_type') or RecordRelation.RELATED
        if rel_type not in LABELS:
            return Response({'detail': 'Unknown relationship type.'}, status=status.HTTP_400_BAD_REQUEST)
        if target.pk == record.pk:
            return Response({'detail': 'A record cannot be related to itself.'}, status=status.HTTP_400_BAD_REQUEST)
        note = ' '.join(str(request.data.get('note') or '').split())[:200]

        existing = RecordRelation.objects.filter(from_record=record, to_record=target, relation_type=rel_type)
        if rel_type == RecordRelation.RELATED:  # symmetric: A-B and B-A are the same link
            existing = existing | RecordRelation.objects.filter(from_record=target, to_record=record, relation_type=rel_type)
        if existing.exists():
            return Response({'detail': 'These records are already linked that way.'}, status=status.HTTP_409_CONFLICT)

        rel = RecordRelation.objects.create(
            from_record=record, to_record=target, relation_type=rel_type, note=note, created_by=request.user,
        )
        log_action(request, AuditAction.UPDATE, record, extra={'relation': rel_type, 'with': target.reference_number})
        return Response({'id': rel.pk}, status=status.HTTP_201_CREATED)


class RecordRelationDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, rel_id):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'edit')
        rel = get_object_or_404(RecordRelation.objects.filter(Q(from_record=record) | Q(to_record=record)), pk=rel_id)
        log_action(request, AuditAction.UPDATE, record, extra={'relation_removed': rel.relation_type})
        rel.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
