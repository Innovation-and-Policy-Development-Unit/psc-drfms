from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from .models import ApiKey, WebhookEndpoint
from .serializers import ApiKeySerializer, ApiKeyCreateSerializer, WebhookSerializer
from apps.accounts.permissions import IsAdministrator


class ApiKeyListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ApiKeyCreateSerializer
        return ApiKeySerializer

    def get_queryset(self):
        return ApiKey.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = ApiKeyCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        key = serializer.save()
        # Return full key ONCE at creation
        data = ApiKeySerializer(key).data
        data['key'] = key.key
        return Response(data, status=201)


class ApiKeyRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def post(self, request, pk):
        key = ApiKey.objects.get(pk=pk, user=request.user)
        key.is_active = False
        key.save(update_fields=['is_active'])
        return Response({'detail': 'API key revoked.'})


class WebhookListView(generics.ListCreateAPIView):
    queryset = WebhookEndpoint.objects.all()
    serializer_class = WebhookSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class WebhookDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = WebhookEndpoint.objects.all()
    serializer_class = WebhookSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        checks = {}

        # Database
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
            checks['database'] = 'ok'
        except Exception as e:
            checks['database'] = f'error: {e}'

        # Redis
        try:
            from django.core.cache import cache
            cache.set('health', 'ok', 5)
            checks['redis'] = 'ok' if cache.get('health') == 'ok' else 'error'
        except Exception as e:
            checks['redis'] = f'error: {e}'

        # Celery
        try:
            from celery_app import app
            inspect = app.control.inspect(timeout=2)
            active = inspect.active()
            checks['celery'] = 'ok' if active else 'no workers'
        except Exception:
            checks['celery'] = 'unknown'

        status_code = 200 if all(v == 'ok' for v in checks.values() if 'error' not in str(v)) else 503
        return Response({'status': 'healthy' if status_code == 200 else 'degraded', 'checks': checks, 'timestamp': timezone.now()}, status=status_code)
