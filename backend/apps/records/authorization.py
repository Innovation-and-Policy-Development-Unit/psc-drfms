"""Object-level authorization for records.

Access = role clearance (classification matrix) OR custodian/author
OR an unexpired DocumentPermission grant (user- or department-scoped).
Route-level role guards in the frontend are cosmetic; these checks are
the enforcement point.
"""
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied

from apps.accounts.models import UserRole
from .models import ClassificationLevel, Record

CLASSIFICATION_RANK = {
    ClassificationLevel.UNCLASSIFIED: 0,
    ClassificationLevel.INTERNAL: 1,
    ClassificationLevel.CONFIDENTIAL: 2,
    ClassificationLevel.RESTRICTED: 3,
    ClassificationLevel.SECRET: 4,
}

# Highest classification each role may access without an explicit grant
ROLE_CLEARANCE = {
    UserRole.READ_ONLY: CLASSIFICATION_RANK[ClassificationLevel.INTERNAL],
    UserRole.REVIEWER: CLASSIFICATION_RANK[ClassificationLevel.CONFIDENTIAL],
    UserRole.RECORDS_OFFICER: CLASSIFICATION_RANK[ClassificationLevel.RESTRICTED],
    UserRole.DIRECTOR: CLASSIFICATION_RANK[ClassificationLevel.RESTRICTED],
    UserRole.COMMISSIONER: CLASSIFICATION_RANK[ClassificationLevel.SECRET],
    UserRole.ADMINISTRATOR: CLASSIFICATION_RANK[ClassificationLevel.SECRET],
}

EDIT_ROLES = {UserRole.RECORDS_OFFICER, UserRole.DIRECTOR, UserRole.COMMISSIONER, UserRole.ADMINISTRATOR}


def _clearance(user):
    return ROLE_CLEARANCE.get(user.role, 0)


def _has_clearance(user, record):
    return _clearance(user) >= CLASSIFICATION_RANK.get(record.classification_level, 0)


def _is_owner(user, record):
    return record.custodian_id == user.id or record.author_id == user.id


def _grant(user, record):
    """Unexpired DocumentPermission row for this user or their department, or None."""
    now = timezone.now()
    grant_q = Q(user=user)
    if user.department_id:
        grant_q |= Q(department_id=user.department_id)
    return (
        record.permissions
        .filter(grant_q)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .order_by('-can_edit', '-can_download')
        .first()
    )


def series_with_descendants(series_id):
    """A series id plus the ids of every series nested under it."""
    from .models import RecordSeries
    ids, frontier = {series_id}, [series_id]
    while frontier:
        children = list(RecordSeries.objects.filter(parent_id__in=frontier).values_list('pk', flat=True))
        frontier = [c for c in children if c not in ids]
        ids.update(frontier)
    return ids


def _rules_for(user):
    """Active automatic-permission rules that apply to this user (by user or department)."""
    from .models import PermissionRule
    who = Q(user=user)
    if user.department_id:
        who |= Q(department_id=user.department_id)
    return list(PermissionRule.objects.filter(is_active=True).filter(who))


def _rule_matches(rule, record):
    if CLASSIFICATION_RANK.get(record.classification_level, 99) > CLASSIFICATION_RANK.get(rule.max_classification, 0):
        return False
    if rule.document_type and record.document_type != rule.document_type:
        return False
    if rule.record_series_id:
        if not record.record_series_id:
            return False
        allowed = series_with_descendants(rule.record_series_id) if rule.include_subseries else {rule.record_series_id}
        if record.record_series_id not in allowed:
            return False
    return True


def matching_rules(user, record):
    return [r for r in _rules_for(user) if _rule_matches(r, record)]


def _grant_allows(user, record, flag):
    """Does a DocumentPermission row or an automatic rule give this user `flag` (can_view, can_edit, ...)?"""
    grant = _grant(user, record)
    if grant and getattr(grant, flag):
        return True
    return any(getattr(rule, flag) for rule in matching_rules(user, record))


def _rules_q(user):
    """Q for records the user may view through automatic rules (empty Q() would mean everything, so None if no rules)."""
    q = None
    for rule in _rules_for(user):
        if not rule.can_view:
            continue
        allowed = [lvl for lvl, rank in CLASSIFICATION_RANK.items() if rank <= CLASSIFICATION_RANK.get(rule.max_classification, 0)]
        part = Q(classification_level__in=allowed)
        if rule.document_type:
            part &= Q(document_type=rule.document_type)
        if rule.record_series_id:
            ids = series_with_descendants(rule.record_series_id) if rule.include_subseries else {rule.record_series_id}
            part &= Q(record_series_id__in=ids)
        q = part if q is None else q | part
    return q


def can_view(user, record):
    if user.role == UserRole.ADMINISTRATOR or _is_owner(user, record) or _has_clearance(user, record):
        return True
    return _grant_allows(user, record, 'can_view')


def can_download(user, record):
    if user.role == UserRole.ADMINISTRATOR or _is_owner(user, record) or _has_clearance(user, record):
        return True
    return _grant_allows(user, record, 'can_download')


def can_edit(user, record):
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if _is_owner(user, record):
        return True
    if user.role in EDIT_ROLES and _has_clearance(user, record):
        return True
    return _grant_allows(user, record, 'can_edit')


def can_share(user, record):
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if _is_owner(user, record):
        return True
    if user.role in EDIT_ROLES and _has_clearance(user, record):
        return True
    return _grant_allows(user, record, 'can_share')


def can_delete(user, record):
    # Deletion is never granted via DocumentPermission — officer+ with clearance only
    if user.role == UserRole.ADMINISTRATOR:
        return True
    return user.role in EDIT_ROLES and _has_clearance(user, record)


_CHECKS = {
    'view': can_view,
    'download': can_download,
    'edit': can_edit,
    'share': can_share,
    'delete': can_delete,
}


def ensure_record_access(user, record, action='view', allow_deleted=False):
    """Raise PermissionDenied unless `user` may perform `action` on `record`.

    A record in the Recycle bin is treated as not found everywhere except the bin itself
    (``allow_deleted=True``), so deleting really does take it out of reach until restored.
    """
    if record.destroyed_at and not allow_deleted:
        raise NotFound('This record is in the Recycle bin.')
    if not _CHECKS[action](user, record):
        raise PermissionDenied(
            f'You do not have permission to {action} this record '
            f'(classification: {record.get_classification_level_display()}).'
        )
    return record


def visible_records_q(user):
    """Q filter limiting a Record queryset to what `user` may view.

    Callers combining this with other filters should apply .distinct() —
    the permission join can duplicate rows.
    """
    if user.role == UserRole.ADMINISTRATOR:
        return Q()
    allowed_levels = [
        level for level, rank in CLASSIFICATION_RANK.items() if rank <= _clearance(user)
    ]
    now = timezone.now()
    grant_q = Q(permissions__user=user)
    if user.department_id:
        grant_q |= Q(permissions__department_id=user.department_id)
    grant_q &= Q(permissions__can_view=True) & (
        Q(permissions__expires_at__isnull=True) | Q(permissions__expires_at__gt=now)
    )
    combined = (
        Q(classification_level__in=allowed_levels)
        | Q(custodian=user)
        | Q(author=user)
        | grant_q
    )
    rules_q = _rules_q(user)
    return combined | rules_q if rules_q is not None else combined


def visible_records(user, base_queryset=None):
    qs = base_queryset if base_queryset is not None else Record.objects.all()
    if user.role == UserRole.ADMINISTRATOR:
        return qs
    return qs.filter(visible_records_q(user)).distinct()


def viewable_records(user):
    """Live (not destroyed) records `user` may view, as a queryset safe to reuse.

    Unlike `visible_records`, rows are never duplicated by the permission join,
    so counts and aggregates over it are correct, and `.values('pk')` makes a
    cheap subquery for filtering other tables.
    """
    return Record.objects.filter(
        destroyed_at__isnull=True,
        pk__in=Record.objects.filter(visible_records_q(user)).values('pk'),
    )
