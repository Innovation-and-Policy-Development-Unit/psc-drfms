"""Shared DRF serializer patterns for PSC-DRFMS."""

from rest_framework import serializers


class RegistryModelSerializer(serializers.ModelSerializer):
    """Base model serializer with common PSC-DRFMS conventions."""


class UserNameField(serializers.CharField):
    """Read-only display name from a related User FK."""

    def __init__(self, source='get_full_name', **kwargs):
        kwargs.setdefault('read_only', True)
        super().__init__(source=source, **kwargs)


class TimestampedSerializerMixin(serializers.Serializer):
    """Mixin documenting standard audit timestamp fields on list/detail payloads."""

    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
