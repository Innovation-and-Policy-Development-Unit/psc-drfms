from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers
from django.shortcuts import get_object_or_404
from .models import SharedLink, SharedLinkAccess


class SharedLinkSerializer(serializers.ModelSerializer):
    record_title = serializers.CharField(source='record.title', read_only=True)
    record_reference = serializers.CharField(source='record.reference_number', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = SharedLink
        fields = [
            'id', 'record', 'record_title', 'record_reference', 'record_version',
            'token', 'created_by', 'recipient_email', 'recipient_name',
            'allow_download', 'expires_at', 'is_active', 'access_count',
            'created_at', 'is_expired',
        ]
        read_only_fields = ['token', 'created_by', 'access_count', 'created_at']

    def create(self, validated_data):
        password = validated_data.pop('password', '')
        link = SharedLink(**validated_data)
        link.created_by = self.context['request'].user
        if password:
            from django.contrib.auth.hashers import make_password
            link.password = make_password(password)
        link.save()
        return link


class SharedLinkListView(generics.ListCreateAPIView):
    serializer_class = SharedLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SharedLink.objects.filter(created_by=self.request.user).select_related('record')

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
