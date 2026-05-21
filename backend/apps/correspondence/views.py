from rest_framework import generics, permissions
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Correspondence
from .serializers import CorrespondenceSerializer
from apps.accounts.permissions import IsRecordsOfficerOrAbove


class CorrespondenceListView(generics.ListCreateAPIView):
    queryset = Correspondence.objects.select_related('record', 'assigned_to', 'created_by').all()
    serializer_class = CorrespondenceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['direction', 'status', 'priority', 'assigned_to']
    search_fields = ['subject', 'reference_number', 'sender_name', 'sender_organization', 'recipient_name']
    ordering_fields = ['correspondence_date', 'created_at', 'priority']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsRecordsOfficerOrAbove()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CorrespondenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Correspondence.objects.all()
    serializer_class = CorrespondenceSerializer
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]
