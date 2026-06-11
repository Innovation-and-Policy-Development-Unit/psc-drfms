from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from .models import ApiKey


class ApiKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_X_API_KEY', '')
        if not auth_header:
            return None

        try:
            key = ApiKey.objects.select_related('user').get(key=auth_header, is_active=True)
        except ApiKey.DoesNotExist:
            raise AuthenticationFailed('Invalid API key.')

        if key.expires_at and key.expires_at < timezone.now():
            raise AuthenticationFailed('API key expired.')

        key.last_used = timezone.now()
        key.save(update_fields=['last_used'])

        return (key.user, key)
