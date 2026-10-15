"""Hash chain for the audit log.

Every audit row stores the SHA-256 of its own content plus the hash of the row before it
(``prev_hash``). Changing, removing or re-ordering any row breaks every hash after it, so
tampering is detectable by ``manage.py verify_audit_chain`` even by someone with database access.

The hash covers only values stored on the row itself (the user is captured as an e-mail/name
snapshot, the record as its reference number), so it stays valid when a user or record is
later deleted and the foreign keys are cleared.
"""
import hashlib
import json

GENESIS = 'GENESIS'

# Serialised in the hash; the order and names are part of the format and must never change
CHAIN_FIELDS = (
    'seq', 'id', 'user_email', 'user_name', 'action', 'record_reference',
    'ip_address', 'user_agent', 'extra', 'timestamp',
)


def canonical_payload(*, seq, id, user_email, user_name, action, record_reference,
                      ip_address, user_agent, extra, timestamp):
    return {
        'seq': seq,
        'id': str(id),
        'user_email': user_email or '',
        'user_name': user_name or '',
        'action': action,
        'record_reference': record_reference or '',
        'ip_address': ip_address or '',
        'user_agent': user_agent or '',
        'extra': extra or {},
        'timestamp': timestamp.isoformat(),
    }


def compute_hash(prev_hash, payload):
    body = json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str)
    return hashlib.sha256(f'{prev_hash}|{body}'.encode('utf-8')).hexdigest()


def payload_for(entry):
    """The canonical payload of a stored AuditLog row (timestamp normalised to UTC)."""
    from datetime import timezone as dj_tz
    return canonical_payload(
        seq=entry.seq, id=entry.id, user_email=entry.user_email, user_name=entry.user_name,
        action=entry.action, record_reference=entry.record_reference,
        ip_address=str(entry.ip_address) if entry.ip_address else '',
        user_agent=entry.user_agent, extra=entry.extra,
        timestamp=entry.timestamp.astimezone(dj_tz.utc),
    )
