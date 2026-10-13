import time

from django.conf import settings
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsRecordsOfficerOrAbove
from apps.correspondence.models import Correspondence
from apps.records.authorization import can_edit, ensure_record_access, viewable_records
from apps.records.models import Record, RecordSeries, RecordVersion

from . import assist, llm, qa
from .analysis import retention_date_for, series_years
from .tasks import analyze_version, summarize_version

AI_OFF = 'AI is not configured on this system.'


def _rate_limit(user):
    """Per-user cap on model calls per minute, so one person cannot run up the bill."""
    window = int(time.time() // 60)
    key = f'ai_rate:{user.pk}:{window}'
    cache.add(key, 0, 90)
    try:
        used = cache.incr(key)
    except ValueError:
        used = 1
    if used > settings.LLM_RATE_LIMIT_PER_MINUTE:
        raise Throttled(wait=60 - int(time.time()) % 60)


class AiView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def handle_exception(self, exc):
        if isinstance(exc, llm.LLMUnavailable):
            return Response({'detail': str(exc) or AI_OFF}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return super().handle_exception(exc)

    def require_enabled(self):
        if not llm.is_enabled():
            raise llm.LLMUnavailable(AI_OFF)


class AiStatusView(AiView):
    def get(self, request):
        return Response(llm.status())


class AskArchiveView(AiView):
    """Question answering over every record the user may view, with source citations."""

    def post(self, request):
        self.require_enabled()
        try:
            messages = qa.clean_messages(request.data.get('messages') or [
                {'role': 'user', 'content': request.data.get('question', '')},
            ])
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        _rate_limit(request.user)
        return Response(qa.ask(request.user, messages))


class RecordChatView(AiView):
    def post(self, request, pk):
        self.require_enabled()
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'view')
        try:
            messages = qa.clean_messages(request.data.get('messages'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        _rate_limit(request.user)
        return Response(qa.chat_document(request.user, record, messages))


class _EditRecordView(AiView):
    def record_for_edit(self, request, pk):
        record = get_object_or_404(Record, pk=pk, destroyed_at__isnull=True)
        ensure_record_access(request.user, record, 'edit')
        return record


class RecordSummaryView(_EditRecordView):
    """Queue a fresh summary of the latest version (the result appears on the record)."""

    def post(self, request, pk):
        self.require_enabled()
        record = self.record_for_edit(request, pk)
        version = record.versions.order_by('-version_number').first()
        if version is None or not version.ocr_text.strip():
            return Response({'detail': 'This document has no readable text yet.'}, status=status.HTTP_400_BAD_REQUEST)
        if llm.provider_for(record.classification_level) is None:
            raise llm.LLMUnavailable('AI may not read records of this classification.')
        _rate_limit(request.user)
        summarize_version.delay(version.pk)
        return Response({'queued': True}, status=status.HTTP_202_ACCEPTED)


class RecordAnalyzeView(_EditRecordView):
    """Re-run metadata, retention and sensitivity analysis on the latest version."""

    def post(self, request, pk):
        record = self.record_for_edit(request, pk)
        version = record.versions.order_by('-version_number').first()
        if version is None or not version.ocr_text.strip():
            return Response({'detail': 'This document has no readable text yet.'}, status=status.HTTP_400_BAD_REQUEST)
        _rate_limit(request.user)
        analyze_version.delay(version.pk)
        return Response({'queued': True}, status=status.HTTP_202_ACCEPTED)


class ApplyRetentionView(_EditRecordView):
    """A person accepts a suggested series: set it and compute the retention date from it.

    The date is recomputed here from the series and the record's own dates; nothing the
    client sends is trusted. The existing retention scan then queues the disposal review.
    """

    def post(self, request, pk):
        record = self.record_for_edit(request, pk)
        series = get_object_or_404(RecordSeries, pk=request.data.get('record_series'), is_active=True)
        base = record.document_date or record.created_at.date()
        record.record_series = series
        record.retention_date = retention_date_for(base, series_years(series))
        record.save(update_fields=['record_series', 'retention_date', 'updated_at'])
        from apps.audit.utils import log_action
        from apps.audit.models import AuditAction
        log_action(request, AuditAction.UPDATE, record=record, extra={
            'source': 'ai_retention_accepted', 'series': series.code,
            'retention_date': record.retention_date.isoformat(),
        })
        return Response({
            'record_series': str(series.pk), 'series_label': f'{series.code} — {series.name}',
            'retention_date': record.retention_date.isoformat(),
        })


class MarkReviewedView(_EditRecordView):
    def post(self, request, pk):
        record = self.record_for_edit(request, pk)
        version = record.versions.order_by('-version_number').first()
        if version:
            version.ai_review_status = 'reviewed'
            version.save(update_fields=['ai_review_status'])
        return Response({'ok': True})


class ReviewQueueView(AiView):
    """Records where the AI left something for a person to decide (latest version only)."""

    def get(self, request):
        versions = (
            RecordVersion.objects
            .filter(ai_review_status='needs_review', record_id__in=viewable_records(request.user).values('pk'))
            .select_related('record')
            .order_by('-created_at')[:300]
        )
        items = []
        for v in versions:
            latest = v.record.versions.order_by('-version_number').values_list('pk', flat=True).first()
            if latest != v.pk or not can_edit(request.user, v.record):
                continue
            s = v.ai_suggestions or {}
            flags = (s.get('sensitive_flags') or {}).get('value') or []
            items.append({
                'record_id': str(v.record_id), 'title': v.record.title,
                'reference_number': v.record.reference_number,
                'document_type': v.record.document_type,
                'classification_level': v.record.classification_level,
                'created_at': v.created_at,
                'summary': v.ai_summary[:240],
                'reasons': [
                    *(['Sensitive content flagged'] if flags else []),
                    *(['Retention series suggested'] if s.get('record_series') else []),
                    *(['Classification change suggested'] if s.get('classification_level') else []),
                ],
            })
        return Response({'results': items[:100], 'count': len(items)})


class CorrespondenceRouteView(AiView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request, pk):
        self.require_enabled()
        _rate_limit(request.user)
        return Response(assist.route_correspondence(request.user, get_object_or_404(Correspondence, pk=pk)))


class CorrespondenceDraftView(AiView):
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def post(self, request, pk):
        self.require_enabled()
        _rate_limit(request.user)
        return Response(assist.draft_reply(
            request.user, get_object_or_404(Correspondence, pk=pk), str(request.data.get('instructions') or ''),
        ))


class SearchParseView(AiView):
    def post(self, request):
        self.require_enabled()
        text = str(request.data.get('text') or '').strip()
        if not text:
            return Response({'detail': 'Describe what you are looking for.'}, status=status.HTTP_400_BAD_REQUEST)
        _rate_limit(request.user)
        return Response(assist.parse_search(request.user, text))
