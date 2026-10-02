"""Interface appearance: each user's choice plus an organisation default that can be locked."""
from rest_framework import permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator

from .models import AppearanceSettings

MODES = ('light', 'dark', 'system')
DENSITIES = ('compact', 'comfortable')
RADII = ('sharp', 'default', 'round')
THEME_SLUG = r'^[a-z0-9][a-z0-9-]{0,31}$'


class AppearancePrefsSerializer(serializers.Serializer):
    """Any subset of the look settings.

    Theme ids are validated by shape only: the preset list lives in the
    frontend, which falls back to the default for ids it does not know.
    """
    theme = serializers.RegexField(THEME_SLUG, required=False)
    mode = serializers.ChoiceField(MODES, required=False)
    density = serializers.ChoiceField(DENSITIES, required=False)
    radius = serializers.ChoiceField(RADII, required=False)


class OrgAppearanceSerializer(AppearancePrefsSerializer):
    locked = serializers.BooleanField(required=False)


def _org_payload(org):
    return {
        'theme': org.default_theme,
        'mode': org.default_mode,
        'density': org.default_density,
        'radius': org.default_radius,
        'locked': org.locked,
    }


class AppearanceView(APIView):
    """Everything the client needs to decide how to look, in one call."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'org': _org_payload(AppearanceSettings.load()), 'user': request.user.appearance or {}})


class MyAppearanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        if AppearanceSettings.load().locked:
            raise PermissionDenied('Appearance is set by your administrator.')
        ser = AppearancePrefsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        prefs = {**(request.user.appearance or {}), **ser.validated_data}
        request.user.appearance = prefs
        request.user.save(update_fields=['appearance'])
        return Response(prefs)

    patch = put

    def delete(self, request):
        """Reset to the organisation default."""
        request.user.appearance = {}
        request.user.save(update_fields=['appearance'])
        return Response({})


class OrgAppearanceView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def put(self, request):
        ser = OrgAppearanceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        org = AppearanceSettings.load()
        for key, value in ser.validated_data.items():
            setattr(org, 'locked' if key == 'locked' else f'default_{key}', value)
        org.updated_by = request.user
        org.save()
        return Response(_org_payload(org))

    patch = put
