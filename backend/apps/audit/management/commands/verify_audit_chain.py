from django.core.management.base import BaseCommand, CommandError

from apps.audit import chain
from apps.audit.models import AuditLog


def verify_chain():
    """Walk the chain in order. Returns (checked, problem) where problem is None or a description."""
    prev = chain.GENESIS
    expected_seq = None
    checked = 0
    for entry in AuditLog.objects.filter(seq__isnull=False).order_by('seq').iterator(chunk_size=1000):
        if expected_seq is not None and entry.seq != expected_seq:
            return checked, f'Entry(ies) missing: expected sequence {expected_seq}, found {entry.seq}.'
        if entry.prev_hash != prev:
            return checked, f'Entry {entry.seq} ({entry.id}) does not follow the one before it.'
        if chain.compute_hash(entry.prev_hash, chain.payload_for(entry)) != entry.hash:
            return checked, f'Entry {entry.seq} ({entry.id}) has been altered.'
        prev = entry.hash
        expected_seq = entry.seq + 1
        checked += 1
    return checked, None


class Command(BaseCommand):
    help = 'Check the audit log hash chain; exits non-zero and names the first broken entry if it was tampered with.'

    def handle(self, *args, **options):
        checked, problem = verify_chain()
        if problem:
            raise CommandError(f'AUDIT CHAIN BROKEN after {checked} good entries: {problem}')
        self.stdout.write(self.style.SUCCESS(f'Audit chain intact: {checked} entries verified.'))
