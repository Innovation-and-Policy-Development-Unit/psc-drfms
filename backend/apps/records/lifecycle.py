"""
Record lifecycle "subway map" — five stations that collapse the granular
record/workflow state into a citizen-readable journey:

    capture → review → approved → retention → disposition

Station statuses: 'complete', 'current', 'pending', 'blocked'.
"""
from django.utils import timezone


def _station(key, label, status, detail='', date=None):
    return {
        'key': key,
        'label': label,
        'status': status,
        'detail': detail,
        'date': date.isoformat() if date else None,
    }


def build_lifecycle(record) -> dict:
    today = timezone.localdate()
    stations = []

    # 1 — Capture
    version_count = record.versions.count()
    stations.append(_station(
        'capture', 'Captured', 'complete',
        f'{version_count} version{"s" if version_count != 1 else ""} on file' if version_count else 'No file attached yet',
        record.created_at,
    ))

    # 2 & 3 — Review / Approved, driven by the latest workflow
    latest_wf = record.workflows.order_by('-initiated_at').first()
    if latest_wf and latest_wf.status in ('pending', 'in_progress'):
        pending = latest_wf.actions.filter(action='pending').order_by('step_number').first()
        stations.append(_station(
            'review', 'Under review', 'current',
            f'Step {latest_wf.current_step}: {pending.step_name}' if pending else latest_wf.title,
            latest_wf.initiated_at,
        ))
        stations.append(_station('approved', 'Approved', 'pending'))
    elif latest_wf and latest_wf.status == 'approved':
        stations.append(_station('review', 'Reviewed', 'complete', latest_wf.title, latest_wf.initiated_at))
        detail = 'Approval recorded'
        try:
            detail = f'Proof {latest_wf.proof.sha256[:12]}…'
        except Exception:
            pass
        stations.append(_station('approved', 'Approved', 'complete', detail, latest_wf.completed_at))
    elif latest_wf:  # rejected / revision_required / cancelled
        stations.append(_station(
            'review', 'Review', 'blocked',
            latest_wf.get_status_display(), latest_wf.completed_at,
        ))
        stations.append(_station('approved', 'Approved', 'pending'))
    elif record.is_draft:
        stations.append(_station('review', 'Review', 'current', 'Draft — no workflow started yet'))
        stations.append(_station('approved', 'Approved', 'pending'))
    else:
        stations.append(_station('review', 'Review', 'complete', 'Registered without workflow'))
        stations.append(_station('approved', 'Approved', 'complete', 'Registered without workflow'))

    # 4 — Retention
    if record.retention_date:
        if record.retention_date > today:
            days = (record.retention_date - today).days
            stations.append(_station(
                'retention', 'In retention', 'current',
                f'Until {record.retention_date.strftime("%d %b %Y")} ({days} days remaining)',
            ))
        else:
            stations.append(_station(
                'retention', 'Retention ended', 'complete',
                f'Period ended {record.retention_date.strftime("%d %b %Y")}',
            ))
    else:
        detail = 'No retention schedule applies' if not record.record_series_id else 'Awaiting retention date'
        stations.append(_station('retention', 'Retention', 'pending', detail))

    # 5 — Disposition
    if record.erased_at:
        cert = record.destruction_certificate
        stations.append(_station(
            'disposition', 'Disposed', 'complete',
            f'Certificate {cert.certificate_number}' if cert else 'Destroyed',
            record.erased_at,
        ))
    elif record.is_on_legal_hold:
        stations.append(_station('disposition', 'Disposition', 'blocked', 'On legal hold — disposition frozen'))
    else:
        review = record.disposition_reviews.exclude(status='dismissed').order_by('-flagged_at').first()
        if review and review.status == 'pending':
            stations.append(_station('disposition', 'Disposition', 'current', 'Awaiting disposition review', review.flagged_at))
        elif review and review.status == 'approved':
            stations.append(_station(
                'disposition', 'Disposition', 'current',
                f'Approved for {review.get_proposed_action_display().lower()}', review.decided_at,
            ))
        else:
            stations.append(_station('disposition', 'Disposition', 'pending', 'Not yet due'))

    return {
        'recordId': str(record.id),
        'referenceNumber': record.reference_number,
        'isVital': record.is_vital,
        'isOnLegalHold': record.is_on_legal_hold,
        'stations': stations,
    }
