"""Object-level authorization for records.

Access = role clearance (classification matrix) OR custodian/author
OR an unexpired DocumentPermission grant (user- or department-scoped).
Route-level role guards in the frontend are cosmetic; these checks are
the enforcement point.
"""
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

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


def can_view(user, record):
    if user.role == UserRole.ADMINISTRATOR or _is_owner(user, record) or _has_clearance(user, record):
        return True
    grant = _grant(user, record)
    return bool(grant and grant.can_view)


def can_download(user, record):
    if user.role == UserRole.ADMINISTRATOR or _is_owner(user, record) or _has_clearance(user, record):
        return True
    grant = _grant(user, record)
    return bool(grant and grant.can_download)


def can_edit(user, record):
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if _is_owner(user, record):
        return True
    if user.role in EDIT_ROLES and _has_clearance(user, record):
        return True
    grant = _grant(user, record)
    return bool(grant and grant.can_edit)


def can_share(user, record):
    if user.role == UserRole.ADMINISTRATOR:
        return True
    if _is_owner(user, record):
        return True
    if user.role in EDIT_ROLES and _has_clearance(user, record):
        return True
    grant = _grant(user, record)
    return bool(grant and grant.can_share)


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


def ensure_record_access(user, record, action='view'):
    """Raise PermissionDenied unless `user` may perform `action` on `record`."""
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
    return (
        Q(classification_level__in=allowed_levels)
        | Q(custodian=user)
        | Q(author=user)
        | grant_q
    )


def visible_records(user, base_queryset=None):
    qs = base_queryset if base_queryset is not None else Record.objects.all()
    if user.role == UserRole.ADMINISTRATOR:
        return qs
    return qs.filter(visible_records_q(user)).distinct()
