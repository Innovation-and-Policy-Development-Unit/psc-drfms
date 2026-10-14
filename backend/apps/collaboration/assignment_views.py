"""Assignments: ask a colleague to do something with a record by a date. Lighter than a workflow."""
import logging
from datetime import date

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsRecordsOfficerOrAbove
from apps.audit.models import AuditAction
from apps.audit.utils import log_action
from apps.records.authorization import can_view, ensure_record_access, viewable_records
from apps.records.models import Record

from .models import Assignment

logger = logging.getLogger(__name__)


def assignment_json(a):
    return {
        'id': str(a.pk), 'record_id': str(a.record_id), 'record_title': a.record.title,
        'reference_number': a.record.reference_number,
        'assigned_to': a.assigned_to_id, 'assigned_to_name': a.assigned_to.get_full_name(),
        'assigned_by': a.assigned_by_id, 'assigned_by_name': a.assigned_by.get_full_name() if a.assigned_by else '',
        'instruction': a.instruction, 'due_date': a.due_date, 'status': a.status,
        'is_overdue': a.status == Assignment.OPEN and a.due_date is not None and a.due_date < timezone.localdate(),
        'created_at': a.created_at, 'completed_at': a.completed_at, 'completed_note': a.completed_note,
    }


def _notify(user_id, title, message, record):
    """Notifications are a courtesy: a failure here must never undo the assignment."""
    try:
        from apps.notifications.utils import send_notification
        send_notification(
            user_id=user_id, title=title, message=message, notification_type='info',
            related_record_id=str(record.pk), related_url=f'/document/{record.pk}',
        )
    except Exception:
        logger.exception('Could not send assignment notification')


class RecordAssignmentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, record_id):
        record = get_object_or_404(Record, pk=record_id, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'view')
        rows = record.assignments.select_related('record', 'assigned_to', 'assigned_by')
        return Response({'results': [assignment_json(a) for a in rows]})

    def post(self, request, record_id):
        if not IsRecordsOfficerOrAbove().has_permission(request, self):
            return Response({'detail': 'Only records officers and above can assign work.'}, status=status.HTTP_403_FORBIDDEN)
        record = get_object_or_404(Record, pk=record_id, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'view')

        assignee = User.objects.filter(pk=request.data.get('assigned_to'), is_active=True).first()
        if assignee is None:
            return Response({'detail': 'Choose who to assign this to.'}, status=status.HTTP_400_BAD_REQUEST)
        instruction = ' '.join(str(request.data.get('instruction') or '').split())[:500]
        if not instruction:
            return Response({'detail': 'Say what needs doing.'}, status=status.HTTP_400_BAD_REQUEST)
        due = None
        if request.data.get('due_date'):
            try:
                due = date.fromisoformat(str(request.data['due_date'])[:10])
            except ValueError:
                return Response({'detail': 'That due date is not valid.'}, status=status.HTTP_400_BAD_REQUEST)
            if due < timezone.localdate():
                return Response({'detail': 'The due date cannot be in the past.'}, status=status.HTTP_400_BAD_REQUEST)
        # An assignment must not become a way to hand someone a record they are not allowed to see
        if not can_view(assignee, record):
            return Response(
                {'detail': f'{assignee.get_full_name() or assignee.email} cannot open this record yet. Share it with them first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        a = Assignment.objects.create(record=record, assigned_to=assignee, assigned_by=request.user, instruction=instruction, due_date=due)
        log_action(request, AuditAction.UPDATE, record, extra={'assigned_to': assignee.email, 'due': str(due) if due else None})
        when = f' by {due.strftime("%d %b %Y")}' if due else ''
        _notify(assignee.pk, 'New assignment', f'{request.user.get_full_name()} asked you: {instruction}{when} ({record.reference_number})', record)
        return Response(assignment_json(a), status=status.HTTP_201_CREATED)


class MyAssignmentsView(APIView):
    """?scope=mine (default) or given; ?status=open (default), done, cancelled or all."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = request.query_params.get('scope', 'mine')
        wanted = request.query_params.get('status', 'open')
        qs = Assignment.objects.select_related('record', 'assigned_to', 'assigned_by').filter(record__destroyed_at__isnull=True)
        qs = qs.filter(assigned_by=request.user) if scope == 'given' else qs.filter(assigned_to=request.user)
        if wanted != 'all':
            qs = qs.filter(status=wanted)
        # Hide ones whose record the user can no longer open
        visible = set(viewable_records(request.user).filter(pk__in=qs.values('record_id')).values_list('pk', flat=True))
        rows = [a for a in qs if a.record_id in visible][:200]
        return Response({'count': len(rows), 'results': [assignment_json(a) for a in rows]})


class AssignmentActionView(APIView):
    """complete (assignee, assigner or admin), reopen (same), cancel (assigner or admin)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, action):
        a = get_object_or_404(Assignment.objects.select_related('record', 'assigned_to', 'assigned_by'), pk=pk)
        user = request.user
        is_admin = user.role == 'administrator'
        is_assignee, is_assigner = a.assigned_to_id == user.pk, a.assigned_by_id == user.pk
        allowed = {'complete': is_assignee or is_assigner or is_admin, 'reopen': is_assignee or is_assigner or is_admin,
                   'cancel': is_assigner or is_admin}
        if action not in allowed:
            return Response({'detail': 'Unknown action.'}, status=status.HTTP_400_BAD_REQUEST)
        if not allowed[action]:
            return Response({'detail': 'You cannot do that with this assignment.'}, status=status.HTTP_403_FORBIDDEN)

        if action == 'complete' and a.status == Assignment.OPEN:
            a.status, a.completed_at = Assignment.DONE, timezone.now()
            a.completed_note = ' '.join(str(request.data.get('note') or '').split())[:500]
            if a.assigned_by_id and a.assigned_by_id != user.pk:
                _notify(a.assigned_by_id, 'Assignment done', f'{user.get_full_name()} finished: {a.instruction}', a.record)
        elif action == 'reopen' and a.status != Assignment.OPEN:
            a.status, a.completed_at, a.completed_note = Assignment.OPEN, None, ''
        elif action == 'cancel' and a.status == Assignment.OPEN:
            a.status = Assignment.CANCELLED
        else:
            return Response({'detail': f'This assignment is already {a.status}.'}, status=status.HTTP_409_CONFLICT)
        a.save()
        log_action(request, AuditAction.UPDATE, a.record, extra={'assignment': action})
        return Response(assignment_json(a))
