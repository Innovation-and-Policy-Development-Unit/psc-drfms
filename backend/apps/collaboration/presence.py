"""Record presence helpers — shared by the WebSocket consumer."""
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from .models import RecordPresence


def group_name(record_id) -> str:
    return f'record_presence_{record_id}'


def touch_presence(record_id, user_id):
    RecordPresence.objects.update_or_create(
        record_id=record_id,
        user_id=user_id,
        defaults={'last_seen_at': timezone.now()},
    )


def clear_presence(record_id, user_id):
    RecordPresence.objects.filter(record_id=record_id, user_id=user_id).delete()


def serialize_viewers(record_id) -> list[dict]:
    cutoff = timezone.now() - timedelta(seconds=RecordPresence.PRESENCE_TIMEOUT_SECONDS)
    rows = (
        RecordPresence.objects
        .filter(record_id=record_id, last_seen_at__gte=cutoff)
        .select_related('user')
        .order_by('-last_seen_at')
    )
    return [
        {
            'userId': row.user_id,
            'name': row.user.get_full_name() or row.user.email,
            'role': row.user.get_role_display(),
            'lastSeenAt': row.last_seen_at.isoformat(),
        }
        for row in rows
    ]


def broadcast_viewers(record_id):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        group_name(record_id),
        {'type': 'presence_update', 'viewers': serialize_viewers(record_id)},
    )
