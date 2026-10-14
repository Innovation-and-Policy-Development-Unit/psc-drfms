"""Automatic permissions: rules that give a department or user rights on every record that matches."""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Department, User
from apps.accounts.permissions import IsAdministrator
from apps.audit.models import AuditAction
from apps.audit.utils import log_action

from .authorization import CLASSIFICATION_RANK, series_with_descendants
from .models import ClassificationLevel, DocumentType, PermissionRule, Record, RecordSeries

FLAGS = ('can_view', 'can_edit', 'can_download', 'can_share')


def matching_records_q(rule):
    """The records a rule covers, as a Q on Record."""
    levels = [lvl for lvl, rank in CLASSIFICATION_RANK.items() if rank <= CLASSIFICATION_RANK.get(rule.max_classification, 0)]
    q = Q(classification_level__in=levels, destroyed_at__isnull=True)
    if rule.document_type:
        q &= Q(document_type=rule.document_type)
    if rule.record_series_id:
        ids = series_with_descendants(rule.record_series_id) if rule.include_subseries else {rule.record_series_id}
        q &= Q(record_series_id__in=ids)
    return q


def rule_json(rule):
    return {
        'id': rule.pk, 'name': rule.name, 'description': rule.description,
        'department': rule.department_id, 'department_name': rule.department.name if rule.department else '',
        'user': rule.user_id, 'user_name': rule.user.get_full_name() if rule.user else '',
        'record_series': rule.record_series_id,
        'record_series_name': f'{rule.record_series.code} - {rule.record_series.name}' if rule.record_series else '',
        'include_subseries': rule.include_subseries, 'document_type': rule.document_type,
        'max_classification': rule.max_classification,
        **{f: getattr(rule, f) for f in FLAGS},
        'is_active': rule.is_active,
        'matching_records': Record.objects.filter(matching_records_q(rule)).count(),
    }


def _apply(rule, data):
    """Copy and validate fields onto the rule; returns an error message or ''."""
    for field in ('name', 'description'):
        if field in data:
            setattr(rule, field, ' '.join(str(data[field]).split())[:150 if field == 'name' else 300])
    if 'department' in data:
        rule.department = get_object_or_404(Department, pk=data['department']) if data['department'] else None
    if 'user' in data:
        rule.user = get_object_or_404(User, pk=data['user']) if data['user'] else None
    if 'record_series' in data:
        rule.record_series = get_object_or_404(RecordSeries, pk=data['record_series']) if data['record_series'] else None
    if 'document_type' in data:
        if data['document_type'] and data['document_type'] not in DocumentType.values:
            return 'Unknown document type.'
        rule.document_type = data['document_type'] or ''
    if 'max_classification' in data:
        if data['max_classification'] not in ClassificationLevel.values:
            return 'Unknown classification.'
        rule.max_classification = data['max_classification']
    for flag in FLAGS + ('include_subseries', 'is_active'):
        if flag in data:
            setattr(rule, flag, bool(data[flag]))

    if not rule.name:
        return 'Give the rule a name.'
    if not rule.department_id and not rule.user_id:
        return 'Choose a department or a person the rule applies to.'
    if not rule.record_series_id and not rule.document_type:
        return 'Choose a record series or a document type, so the rule does not cover everything.'
    if not any(getattr(rule, f) for f in FLAGS):
        return 'Choose at least one permission to give.'
    if (rule.can_edit or rule.can_share or rule.can_download) and not rule.can_view:
        return 'Editing, downloading and sharing need viewing as well.'
    return ''


class RuleListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def get(self, request):
        rules = PermissionRule.objects.select_related('department', 'user', 'record_series')
        return Response({'results': [rule_json(r) for r in rules]})

    def post(self, request):
        rule = PermissionRule(created_by=request.user)
        error = _apply(rule, request.data)
        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
        rule.save()
        log_action(request, AuditAction.SHARE, extra={'permission_rule': rule.name, 'created': True})
        return Response(rule_json(rule), status=status.HTTP_201_CREATED)


class RuleDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def patch(self, request, pk):
        rule = get_object_or_404(PermissionRule, pk=pk)
        error = _apply(rule, request.data)
        if error:
            return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)
        rule.save()
        log_action(request, AuditAction.SHARE, extra={'permission_rule': rule.name, 'updated': True})
        return Response(rule_json(rule))

    def delete(self, request, pk):
        rule = get_object_or_404(PermissionRule, pk=pk)
        log_action(request, AuditAction.SHARE, extra={'permission_rule': rule.name, 'deleted': True})
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
