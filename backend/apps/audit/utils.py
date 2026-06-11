from .models import AuditLog, AuditAction


def log_action(request, action, record=None, extra=None):
    user = request.user if request.user.is_authenticated else None
    ip = _get_client_ip(request)
    ua = request.META.get('HTTP_USER_AGENT', '')[:500]

    AuditLog.objects.create(
        user=user,
        action=action,
        record=record,
        record_reference=record.reference_number if record else '',
        ip_address=ip,
        user_agent=ua,
        extra=extra or {},
    )


def _get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
