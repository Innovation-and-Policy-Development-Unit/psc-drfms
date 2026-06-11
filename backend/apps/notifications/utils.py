from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification


def send_notification(user_id, title, message, notification_type='info', related_record_id=None, related_url=''):
    notification = Notification.objects.create(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        related_record_id=related_record_id,
        related_url=related_url,
    )

    channel_layer = get_channel_layer()
    group_name = f"notifications_{user_id}"
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'notification_message',
            'data': {
                'id': str(notification.id),
                'title': notification.title,
                'message': notification.message,
                'type': notification.notification_type,
                'created_at': notification.created_at.isoformat(),
                'related_url': notification.related_url,
            },
        }
    )
    return notification
