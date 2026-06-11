import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer


class RecordPresenceConsumer(AsyncWebsocketConsumer):
    """Live "who is viewing this record" — joins a per-record group, announces
    itself, heartbeats every ~30s from the client, and broadcasts the viewer
    list on every join/leave. Stale rows (crashed connections) age out via the
    90s cutoff in serialize_viewers."""

    async def connect(self):
        user = self.scope['user']
        self.record_id = self.scope['url_route']['kwargs']['record_id']
        self.joined = False

        if not user or not user.is_authenticated:
            await self.close()
            return
        if not await self.may_view(user):
            await self.close()
            return

        from .presence import group_name
        self.group = group_name(self.record_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        self.joined = True
        viewers = await self.join_presence(user)
        await self.send(json.dumps({'type': 'presence', 'viewers': viewers}))

    async def disconnect(self, close_code):
        if not self.joined:
            return
        await self.channel_layer.group_discard(self.group, self.channel_name)
        await self.leave_presence(self.scope['user'])

    async def receive(self, text_data):
        data = json.loads(text_data)
        if data.get('type') == 'heartbeat':
            await self.touch(self.scope['user'])

    async def presence_update(self, event):
        await self.send(json.dumps({'type': 'presence', 'viewers': event['viewers']}))

    @database_sync_to_async
    def may_view(self, user):
        from apps.records.authorization import can_view
        from apps.records.models import Record
        record = Record.objects.filter(id=self.record_id).first()
        return bool(record and can_view(user, record))

    @database_sync_to_async
    def join_presence(self, user):
        from .presence import broadcast_viewers, serialize_viewers, touch_presence
        touch_presence(self.record_id, user.id)
        broadcast_viewers(self.record_id)
        return serialize_viewers(self.record_id)

    @database_sync_to_async
    def leave_presence(self, user):
        from .presence import broadcast_viewers, clear_presence
        clear_presence(self.record_id, user.id)
        broadcast_viewers(self.record_id)

    @database_sync_to_async
    def touch(self, user):
        from .presence import touch_presence
        touch_presence(self.record_id, user.id)
