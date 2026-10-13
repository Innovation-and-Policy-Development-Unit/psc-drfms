"""Administrator settings for OneDrive import. Everyone signed in can read the public values; only administrators change them."""
import re

from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .models import OneDriveSettings

GUID = re.compile(r'^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')
TENANT_ALIASES = ('organizations', 'common')


class OneDriveSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OneDriveSettings
        fields = ['enabled', 'client_id', 'tenant_id', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_client_id(self, value):
        value = value.strip()
        if value and not GUID.match(value):
            raise serializers.ValidationError('The application (client) ID is a GUID like 00000000-0000-0000-0000-000000000000.')
        return value

    def validate_tenant_id(self, value):
        value = value.strip()
        if value and value not in TENANT_ALIASES and not GUID.match(value):
            raise serializers.ValidationError('Use the directory (tenant) ID GUID, or "organizations".')
        return value

    def validate(self, attrs):
        inst = self.instance
        if attrs.get('enabled', inst.enabled):
            client = attrs.get('client_id', inst.client_id)
            tenant = attrs.get('tenant_id', inst.tenant_id)
            if not client or not tenant:
                raise serializers.ValidationError('Enter the client ID and tenant ID before turning OneDrive import on.')
        return attrs


class OneDriveSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cfg = OneDriveSettings.load()
        data = OneDriveSettingsSerializer(cfg).data
        if request.user.role != 'administrator' and not cfg.enabled:
            data = {'enabled': False, 'client_id': '', 'tenant_id': '', 'updated_at': data['updated_at']}
        return Response(data)

    def put(self, request):
        if not IsAdministrator().has_permission(request, self):
            self.permission_denied(request)
        cfg = OneDriveSettings.load()
        ser = OneDriveSettingsSerializer(cfg, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        changed = sorted(ser.validated_data)
        cfg = ser.save(updated_by=request.user)
        log_action(request, AuditAction.UPDATE, extra={'onedrive_settings': changed})
        return Response(OneDriveSettingsSerializer(cfg).data)
