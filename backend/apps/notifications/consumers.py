import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope['user']
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.group_name = f"notifications_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send unread count on connect
        count = await self.get_unread_count(user)
        await self.send(json.dumps({'type': 'unread_count', 'count': count}))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get('type') == 'mark_read':
            notification_id = data.get('id')
            if notification_id:
                await self.mark_read(notification_id)

    async def notification_message(self, event):
        await self.send(json.dumps({'type': 'notification', 'data': event['data']}))

    @database_sync_to_async
    def get_unread_count(self, user):
        from .models import Notification
        return Notification.objects.filter(user=user, is_read=False).count()

    @database_sync_to_async
    def mark_read(self, notification_id):
        from django.utils import timezone
        from .models import Notification
        Notification.objects.filter(
            id=notification_id, user=self.scope['user']
        ).update(is_read=True, read_at=timezone.now())
