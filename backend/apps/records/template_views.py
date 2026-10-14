"""Document templates: a ready-made file plus the metadata a new document should start with."""
import hashlib
import mimetypes

from django.core.files.base import ContentFile
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator, IsRecordsOfficerOrAbove
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .blank_docs import KINDS, build_blank
from .models import ClassificationLevel, DocumentTemplate, DocumentType, Record, RecordSeries, RecordVersion

MAX_TEMPLATE_BYTES = 10 * 1024 * 1024

STARTER_TEMPLATES = [
    {
        'name': 'Official letter', 'description': 'Outgoing letter on commission letterhead.',
        'document_type': 'correspondence', 'title_pattern': 'Letter - {date}',
        'paragraphs': [
            {'text': 'PUBLIC SERVICE COMMISSION', 'heading': 1}, {'text': ''},
            {'text': 'Our ref: '}, {'text': 'Date: '}, {'text': ''},
            {'text': 'To: '}, {'text': ''}, {'text': 'Subject: ', 'heading': 2}, {'text': ''},
            {'text': 'Dear Sir / Madam,'}, {'text': ''}, {'text': ''},
            {'text': 'Yours faithfully,'}, {'text': ''}, {'text': 'Secretary to the Commission'},
        ],
    },
    {
        'name': 'Meeting minutes', 'description': 'Attendance, agenda items, decisions and actions.',
        'document_type': 'report', 'title_pattern': 'Minutes - {date}',
        'paragraphs': [
            {'text': 'Meeting minutes', 'heading': 1}, {'text': 'Date and place: '}, {'text': ''},
            {'text': 'Present', 'heading': 2}, {'text': ''}, {'text': 'Apologies', 'heading': 2}, {'text': ''},
            {'text': 'Agenda items and discussion', 'heading': 2}, {'text': ''},
            {'text': 'Decisions', 'heading': 2}, {'text': ''},
            {'text': 'Actions (who, what, by when)', 'heading': 2}, {'text': ''},
        ],
    },
    {
        'name': 'Commission submission', 'description': 'Paper for a decision or for noting by the Commission.',
        'document_type': 'submission', 'classification_level': 'confidential', 'title_pattern': 'Submission - {date}',
        'paragraphs': [
            {'text': 'Commission submission', 'heading': 1}, {'text': 'For decision / for noting: '}, {'text': ''},
            {'text': 'Purpose', 'heading': 2}, {'text': ''}, {'text': 'Background', 'heading': 2}, {'text': ''},
            {'text': 'Analysis and options', 'heading': 2}, {'text': ''},
            {'text': 'Financial implications', 'heading': 2}, {'text': ''},
            {'text': 'Recommendation', 'heading': 2}, {'text': ''},
        ],
    },
]


def template_json(t):
    return {
        'id': t.pk, 'name': t.name, 'description': t.description, 'kind': t.kind, 'file_name': t.file_name,
        'document_type': t.document_type, 'classification_level': t.classification_level,
        'record_series': t.record_series_id, 'record_series_name': t.record_series.name if t.record_series else '',
        'title_pattern': t.title_pattern, 'is_active': t.is_active,
    }


def render_title(pattern, fallback):
    today = timezone.localdate()
    title = (pattern or '').replace('{date}', today.strftime('%d %b %Y')).replace('{year}', str(today.year))
    return title.strip() or fallback


def _apply_fields(template, data):
    """Copy the editable fields from `data` onto `template`, validating choices. Returns an error string or ''."""
    if 'name' in data:
        name = ' '.join(str(data['name']).split())[:150]
        if not name:
            return 'Give the template a name.'
        if DocumentTemplate.objects.filter(name__iexact=name).exclude(pk=template.pk).exists():
            return 'A template with that name already exists.'
        template.name = name
    if 'description' in data:
        template.description = ' '.join(str(data['description']).split())[:300]
    if 'document_type' in data:
        if data['document_type'] not in DocumentType.values:
            return 'Unknown document type.'
        template.document_type = data['document_type']
    if 'classification_level' in data:
        if data['classification_level'] not in ClassificationLevel.values:
            return 'Unknown classification.'
        template.classification_level = data['classification_level']
    if 'record_series' in data:
        series_id = data['record_series']
        template.record_series = get_object_or_404(RecordSeries, pk=series_id, is_active=True) if series_id else None
    if 'title_pattern' in data:
        template.title_pattern = str(data['title_pattern'])[:200]
    if 'is_active' in data:
        template.is_active = str(data['is_active']).lower() in ('true', '1', 'yes')
    return ''


class TemplateListCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdministrator()]
        return [permissions.IsAuthenticated(), IsRecordsOfficerOrAbove()]

    def get(self, request):
        qs = DocumentTemplate.objects.select_related('record_series')
        if not (request.query_params.get('all') and request.user.role == 'administrator'):
            qs = qs.filter(is_active=True)
        return Response({'results': [template_json(t) for t in qs]})

    def post(self, request):
        kind = request.data.get('kind', 'word')
        if kind not in KINDS:
            return Response({'detail': 'kind must be word, excel or powerpoint.'}, status=status.HTTP_400_BAD_REQUEST)
        template = DocumentTemplate(kind=kind, created_by=request.user)
        error = _apply_fields(template, request.data)
        if error or not template.name:
            return Response({'detail': error or 'Give the template a name.'}, status=status.HTTP_400_BAD_REQUEST)

        upload = request.FILES.get('file')
        ext, mime = KINDS[kind]
        if upload:
            if upload.size > MAX_TEMPLATE_BYTES:
                return Response({'detail': 'Template files can be at most 10 MB.'}, status=status.HTTP_400_BAD_REQUEST)
            if not upload.name.lower().endswith('.' + ext):
                return Response({'detail': f'A {kind} template must be a .{ext} file.'}, status=status.HTTP_400_BAD_REQUEST)
            content, file_name = upload.read(), upload.name
        else:
            content, _, _ = build_blank(kind)
            file_name = f'{template.name}.{ext}'
        template.mime_type = mime
        template.file_name = file_name[:300]
        template.file.save(file_name, ContentFile(content), save=False)
        template.save()
        log_action(request, AuditAction.CREATE, extra={'template': template.name})
        return Response(template_json(template), status=status.HTTP_201_CREATED)


class TemplateDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, pk):
        template = get_object_or_404(DocumentTemplate, pk=pk)
        error = _apply_fields(template, request.data)
        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
        template.save()
        log_action(request, AuditAction.UPDATE, extra={'template': template.name})
        return Response(template_json(template))

    def delete(self, request, pk):
        template = get_object_or_404(DocumentTemplate, pk=pk)
        log_action(request, AuditAction.DELETE, extra={'template': template.name})
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TemplateStarterView(APIView):
    """Administrators: add the built-in starter templates (letter, minutes, submission) if they are missing."""
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def post(self, request):
        ext, mime = KINDS['word']
        added = []
        for spec in STARTER_TEMPLATES:
            if DocumentTemplate.objects.filter(name=spec['name']).exists():
                continue
            content, _, _ = build_blank('word', spec['paragraphs'])
            t = DocumentTemplate(
                name=spec['name'], description=spec['description'], kind='word', mime_type=mime,
                file_name=f"{spec['name']}.{ext}", document_type=spec['document_type'],
                classification_level=spec.get('classification_level', 'internal'),
                title_pattern=spec['title_pattern'], created_by=request.user,
            )
            t.file.save(t.file_name, ContentFile(content), save=False)
            t.save()
            added.append(t.name)
        return Response({'added': added})


class TemplateUseView(APIView):
    """Create a new record from a template and return it, ready to open in the editor."""
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request, pk):
        template = get_object_or_404(DocumentTemplate, pk=pk, is_active=True)
        series = template.record_series
        if request.data.get('record_series'):
            series = get_object_or_404(RecordSeries, pk=request.data['record_series'], is_active=True)
        title = ' '.join(str(request.data.get('title') or '').split())[:200] or render_title(template.title_pattern, template.name)

        with template.file.open('rb') as fh:
            content = fh.read()
        record = Record.objects.create(
            title=title, document_type=template.document_type, classification_level=template.classification_level,
            record_series=series, custodian=request.user, author=request.user,
        )
        file_name = f'{title}.{KINDS[template.kind][0]}'[:500]
        version = RecordVersion(
            record=record, version_number=1, file_name=file_name, file_size=len(content), mime_type=template.mime_type,
            content_hash=hashlib.sha256(content).hexdigest(), change_summary=f'Created from template "{template.name}"',
            created_by=request.user,
        )
        version.file.save(file_name, ContentFile(content), save=False)
        version.save()
        log_action(request, AuditAction.CREATE, record, extra={'from_template': template.name})
        return Response({'id': str(record.pk), 'reference_number': record.reference_number}, status=status.HTTP_201_CREATED)
