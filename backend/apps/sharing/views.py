from django.contrib.auth.hashers import check_password
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.records.authorization import ensure_record_access
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
        record = serializer.validated_data['record']
        ensure_record_access(self.request.user, record, 'share')
        serializer.save(created_by=self.request.user)


class SharedLinkRevokeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, token):
        link = get_object_or_404(SharedLink, token=token, created_by=request.user)
        link.is_active = False
        link.save(update_fields=['is_active'])
        return Response({'detail': 'Link revoked.'})


def _check_link_password(link, request):
    """Returns an error Response if the link's password gate fails, else None."""
    if not link.password:
        return None
    provided = request.headers.get('X-Share-Password') or request.query_params.get('password', '')
    if not provided:
        return Response(
            {'detail': 'This link is password protected.', 'password_required': True},
            status=401,
        )
    if not check_password(provided, link.password):
        return Response(
            {'detail': 'Incorrect password.', 'password_required': True},
            status=401,
        )
    return None


def _log_access(link, request):
    ip = request.META.get('REMOTE_ADDR')
    ua = request.META.get('HTTP_USER_AGENT', '')[:500]
    SharedLinkAccess.objects.create(shared_link=link, ip_address=ip, user_agent=ua)
    link.access_count += 1
    link.save(update_fields=['access_count'])


class SharedDocumentView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        link = get_object_or_404(SharedLink.objects.select_related('record'), token=token)
        if not link.is_accessible:
            return Response({'detail': 'This link has expired or been revoked.'}, status=403)

        denied = _check_link_password(link, request)
        if denied:
            return denied

        _log_access(link, request)

        record = link.record
        version = link.record_version or record.versions.order_by('-version_number').first()
        # Deliberately minimal payload — this endpoint is public.
        return Response({
            'title': record.title,
            'reference_number': record.reference_number,
            'description': record.description,
            'document_type': record.document_type,
            'allow_download': link.allow_download,
            'latest_version': {
                'file_name': version.file_name,
                'mime_type': version.mime_type,
                'file_size': version.file_size,
                'file_url': f'/api/sharing/{link.token}/download/' if link.allow_download else None,
            } if version else None,
        })


class SharedDocumentDownloadView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        link = get_object_or_404(SharedLink.objects.select_related('record'), token=token)
        if not link.is_accessible:
            return Response({'detail': 'This link has expired or been revoked.'}, status=403)
        if not link.allow_download:
            return Response({'detail': 'Downloads are not permitted for this link.'}, status=403)

        denied = _check_link_password(link, request)
        if denied:
            return denied

        version = link.record_version or link.record.versions.order_by('-version_number').first()
        if not version:
            return Response({'detail': 'No file is attached to this record.'}, status=404)

        _log_access(link, request)

        response = FileResponse(
            version.file.open('rb'),
            content_type=version.mime_type or 'application/octet-stream',
        )
        response['Content-Disposition'] = f'attachment; filename="{version.file_name}"'
        return response
