from django.urls import re_path

from .consumers import RecordPresenceConsumer

websocket_urlpatterns = [
    re_path(r'^ws/records/(?P<record_id>[0-9a-f-]+)/presence/$', RecordPresenceConsumer.as_asgi()),
]
