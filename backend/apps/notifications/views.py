from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.utils import timezone
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        unread_only = self.request.query_params.get('unread')
        if unread_only == 'true':
            qs = qs.filter(is_read=False)
        return qs


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_all_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(
        is_read=True, read_at=timezone.now()
    )
    return Response({'detail': 'All notifications marked as read.'})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_read(request, pk):
    Notification.objects.filter(id=pk, user=request.user).update(
        is_read=True, read_at=timezone.now()
    )
    return Response({'detail': 'Notification marked as read.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def activity_feed(request):
    """Recent notifications and audit events for the current user."""
    from apps.audit.models import AuditLog

    limit = min(int(request.query_params.get('limit', 20)), 50)
    items = []

    for n in Notification.objects.filter(user=request.user).order_by('-created_at')[:limit]:
        items.append({
            'id': str(n.id),
            'type': 'notification',
            'title': n.title,
            'message': n.message,
            'notification_type': n.notification_type,
            'related_record': str(n.related_record_id) if n.related_record_id else None,
            'related_url': n.related_url or (f'/document/{n.related_record_id}' if n.related_record_id else ''),
            'is_read': n.is_read,
            'timestamp': n.created_at.isoformat(),
        })

    for log in AuditLog.objects.filter(user=request.user).select_related('record').order_by('-timestamp')[:limit]:
        items.append({
            'id': str(log.id),
            'type': 'audit',
            'title': log.action.replace('_', ' ').title(),
            'message': log.record_reference or (log.record.title if log.record else ''),
            'related_record': str(log.record_id) if log.record_id else None,
            'related_url': f'/document/{log.record_id}' if log.record_id else '',
            'timestamp': log.timestamp.isoformat(),
        })

    items.sort(key=lambda x: x['timestamp'], reverse=True)
    return Response({'results': items[:limit]})
