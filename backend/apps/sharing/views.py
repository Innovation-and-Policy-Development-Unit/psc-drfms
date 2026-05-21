from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import SharedLink, SharedLinkAccess
from .serializers import SharedLinkSerializer


class SharedLinkListView(generics.ListCreateAPIView):
    serializer_class = SharedLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SharedLink.objects.filter(created_by=self.request.user).select_related('record')
        record_id = self.request.query_params.get('record')
        if record_id:
            qs = qs.filter(record_id=record_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SharedLinkRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, token):
        link = get_object_or_404(SharedLink, token=token, created_by=request.user)
        link.is_active = False
        link.save(update_fields=['is_active'])
        return Response({'detail': 'Link revoked.'})


class SharedDocumentView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        link = get_object_or_404(SharedLink, token=token)
        if not link.is_accessible:
            return Response({'detail': 'This link has expired or been revoked.'}, status=403)

        # Log access
        ip = request.META.get('REMOTE_ADDR')
        ua = request.META.get('HTTP_USER_AGENT', '')[:500]
        SharedLinkAccess.objects.create(shared_link=link, ip_address=ip, user_agent=ua)
        link.access_count += 1
        link.save(update_fields=['access_count'])

        from apps.records.serializers import RecordDetailSerializer
        data = RecordDetailSerializer(link.record).data
        data['allow_download'] = link.allow_download
        return Response(data)
