import hashlib
import hmac as hmaclib
import json
import mimetypes
import urllib.request

import jwt
from django.conf import settings
from django.core.files.base import ContentFile
from django.http import FileResponse, HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.records.models import RecordVersion


def _make_token(record_id, version_id):
    secret = settings.ONLYOFFICE_JWT_SECRET.encode()
    msg = f"oo-doc:{record_id}:{version_id}".encode()
    return hmaclib.new(secret, msg, hashlib.sha256).hexdigest()


def _verify_token(token, record_id, version_id):
    expected = _make_token(str(record_id), str(version_id))
    return hmaclib.compare_digest(token, expected)


def _oo_type(mime_type, file_name):
    mime = (mime_type or '').lower()
    name = (file_name or '').lower()
    ext = name.rsplit('.', 1)[-1] if '.' in name else ''
    if 'word' in mime or ext in ('doc', 'docx'):
        return 'word', ext or 'docx'
    if 'sheet' in mime or 'excel' in mime or ext in ('xls', 'xlsx'):
        return 'cell', ext or 'xlsx'
    if 'presentation' in mime or 'powerpoint' in mime or ext in ('ppt', 'pptx'):
        return 'slide', ext or 'pptx'
    return 'word', ext or 'docx'


class OnlyOfficeConfigView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, record_id, version_id):
        version = get_object_or_404(
            RecordVersion.objects.select_related('record'),
            id=version_id,
            record_id=record_id,
        )
        token = _make_token(str(record_id), str(version_id))
        backend_url = settings.ONLYOFFICE_BACKEND_INTERNAL_URL
        doc_type, file_type = _oo_type(version.mime_type, version.file_name)

        config = {
            'documentType': doc_type,
            'document': {
                'fileType': file_type,
                'key': f"rec{record_id}v{version_id}",
                'title': version.file_name or 'document',
                'url': f"{backend_url}/api/onlyoffice/document/{record_id}/{version_id}/{token}/",
                'permissions': {
                    'edit': True,
                    'download': True,
                    'print': True,
                    'review': True,
                    'comment': True,
                    'fillForms': True,
                },
            },
            'editorConfig': {
                'callbackUrl': f"{backend_url}/api/onlyoffice/callback/{record_id}/{version_id}/{token}/",
                'lang': 'en',
                'mode': 'edit',
                'user': {
                    'id': str(request.user.id),
                    'name': request.user.get_full_name() or request.user.username,
                },
                'customization': {
                    'autosave': True,
                    'compactHeader': True,
                    'toolbarNoTabs': False,
                    'chat': True,
                    'comments': True,
                },
            },
        }

        secret = settings.ONLYOFFICE_JWT_SECRET
        if secret:
            config['token'] = jwt.encode({'payload': config}, secret, algorithm='HS256')

        return Response({
            **config,
            'editor_api_url': f"{settings.ONLYOFFICE_PUBLIC_URL}/web-apps/apps/api/documents/api.js",
        })


def onlyoffice_document(request, record_id, version_id, token):
    if not _verify_token(token, str(record_id), str(version_id)):
        return HttpResponseForbidden('Invalid token')
    version = get_object_or_404(RecordVersion, id=version_id, record_id=record_id)
    response = FileResponse(
        version.file.open('rb'),
        content_type=version.mime_type or 'application/octet-stream',
    )
    response['Content-Disposition'] = f'inline; filename="{version.file_name}"'
    return response


@csrf_exempt
def onlyoffice_callback(request, record_id, version_id, token):
    if request.method != 'POST':
        return JsonResponse({'error': 0})
    if not _verify_token(token, str(record_id), str(version_id)):
        return JsonResponse({'error': 1, 'message': 'forbidden'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'error': 1})

    # status 2 = document is ready to be saved, 6 = force-save
    if data.get('status') in (2, 6) and data.get('url'):
        try:
            _create_version(record_id, version_id, data['url'])
        except Exception:
            pass  # must return error:0 so OnlyOffice stops retrying

    return JsonResponse({'error': 0})


def _create_version(record_id, version_id, download_url):
    from django.db.models import Max
    orig = RecordVersion.objects.select_related('record').get(id=version_id, record_id=record_id)
    record = orig.record

    with urllib.request.urlopen(download_url, timeout=60) as f:
        content = f.read()

    next_num = (record.versions.aggregate(m=Max('version_number'))['m'] or 0) + 1
    content_hash = hashlib.sha256(content).hexdigest()

    new_v = RecordVersion(
        record=record,
        version_number=next_num,
        file_name=orig.file_name,
        mime_type=orig.mime_type,
        file_size=len(content),
        content_hash=content_hash,
        change_summary='Saved via OnlyOffice collaborative editor',
        created_by=orig.created_by,
    )
    new_v.file.save(orig.file_name, ContentFile(content), save=True)
