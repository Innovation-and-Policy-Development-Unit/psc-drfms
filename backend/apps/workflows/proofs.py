"""
Cryptographic workflow proofs — canonical snapshot + SHA-256 at completion.

When a workflow instance reaches a terminal decision (approved / rejected /
revision_required), a canonical JSON snapshot of everything that informed the
decision is stored alongside its SHA-256 digest. Verification recomputes the
digest from the stored payload (detects payload tampering) and rebuilds a
fresh snapshot from the live database (detects later mutation of the
underlying record, versions, or workflow actions).
"""
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

PROOF_VERSION = 1

# Fields compared against the live database during verification. The snapshot
# also carries display-only context (names, titles) excluded from this check.
TERMINAL_STATUSES = ('approved', 'rejected', 'revision_required')


def canonical_json(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str)


def compute_sha256(payload: dict) -> str:
    return hashlib.sha256(canonical_json(payload).encode()).hexdigest()


def build_snapshot(instance) -> dict:
    """Canonical snapshot of a workflow instance and the record state it judged."""
    record = instance.record
    versions = [
        {
            'version_number': v.version_number,
            'file_name': v.file_name,
            'file_size': v.file_size,
            'content_hash': v.content_hash,
            'created_at': v.created_at.isoformat(),
        }
        for v in record.versions.order_by('version_number')
    ]
    actions = [
        {
            'step_number': a.step_number,
            'step_name': a.step_name,
            'action': a.action,
            'actor': a.assigned_to.email if a.assigned_to else None,
            'comments': a.comments,
            'actioned_at': a.actioned_at.isoformat() if a.actioned_at else None,
        }
        for a in instance.actions.order_by('step_number', 'id')
    ]
    return {
        'proof_version': PROOF_VERSION,
        'workflow': {
            'id': str(instance.id),
            'title': instance.title,
            'template': instance.template.name if instance.template else None,
            'status': instance.status,
            'initiated_by': instance.initiated_by.email if instance.initiated_by else None,
            'initiated_at': instance.initiated_at.isoformat(),
            'completed_at': instance.completed_at.isoformat() if instance.completed_at else None,
        },
        'record': {
            'id': str(record.id),
            'reference_number': record.reference_number,
            'title': record.title,
            'document_type': record.document_type,
            'classification_level': record.classification_level,
        },
        'versions': versions,
        'actions': actions,
    }


def generate_proof(instance):
    """Create (idempotently) the proof for a completed workflow instance.

    Never raises — proof generation must not block workflow progression.
    """
    from .models import WorkflowProof
    try:
        if instance.status not in TERMINAL_STATUSES:
            return None
        existing = WorkflowProof.objects.filter(instance=instance).first()
        if existing:
            return existing
        payload = build_snapshot(instance)
        proof = WorkflowProof.objects.create(
            instance=instance,
            outcome=instance.status,
            payload=payload,
            sha256=compute_sha256(payload),
        )
        # Second anchor: persist the digest in the append-only audit trail so
        # tampering with the proof row itself is also detectable.
        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            user=None,
            action='approve' if instance.status == 'approved' else 'reject',
            record=instance.record,
            record_reference=instance.record.reference_number,
            extra={
                'event': 'workflow_proof_generated',
                'workflow_id': str(instance.id),
                'outcome': instance.status,
                'proof_sha256': proof.sha256,
            },
        )
        return proof
    except Exception:
        logger.exception('Proof generation failed for workflow %s', instance.pk)
        return None


def verify_proof(proof) -> dict:
    """Check the stored payload against its digest and against live DB state."""
    stored_hash_ok = compute_sha256(proof.payload) == proof.sha256

    mismatches = []
    try:
        # Reload from the database — cached related objects must not mask tampering.
        from .models import WorkflowInstance
        instance = WorkflowInstance.objects.select_related(
            'record', 'template', 'initiated_by',
        ).get(pk=proof.instance_id)
        fresh = build_snapshot(instance)
        for section in ('workflow', 'record', 'versions', 'actions'):
            if fresh.get(section) != proof.payload.get(section):
                mismatches.append(section)
        state_match = not mismatches
    except Exception:
        logger.exception('Proof state comparison failed for proof %s', proof.pk)
        state_match = False
        mismatches.append('comparison_error')

    return {
        'valid': stored_hash_ok and state_match,
        'stored_hash_ok': stored_hash_ok,
        'state_match': state_match,
        'mismatched_sections': mismatches,
    }
