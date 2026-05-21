from rest_framework import generics, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from .models import AuditLog, CustodyRecord
from .serializers import AuditLogSerializer, CustodyRecordSerializer
from apps.accounts.permissions import IsDirectorOrAbove, IsAdministrator


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['action', 'user', 'record']
    search_fields = ['user__email', 'record_reference', 'ip_address']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user', 'record')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
        return qs


class CustodyChainView(generics.ListCreateAPIView):
    serializer_class = CustodyRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustodyRecord.objects.filter(record_id=self.kwargs['record_id']).select_related('transferred_from', 'transferred_to')

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user, record_id=self.kwargs['record_id'])
