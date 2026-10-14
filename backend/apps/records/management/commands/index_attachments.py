"""Read the text of attachments that have not been read yet, so search and the AI can find what is inside them.

Attachments added before text reading existed (and ones whose reading failed) are picked up here.
Safe to repeat: attachments already read are skipped.

  python manage.py index_attachments
"""
from django.core.management.base import BaseCommand

from apps.records.models import RecordAttachment
from apps.records.tasks import process_attachment_text, refresh_record_index


class Command(BaseCommand):
    help = 'Read the text of attachments that are not searchable yet.'

    def handle(self, *args, **options):
        pending = list(RecordAttachment.objects.filter(ocr_processed=False, record__destroyed_at__isnull=True)
                       .values_list('pk', 'record_id'))
        done = 0
        for pk, _ in pending:
            try:
                # Run here rather than queueing, so the command reports what happened
                process_attachment_text.apply(args=[pk], throw=True)
                done += 1
            except Exception as exc:
                self.stderr.write(f'  failed  attachment {pk}: {exc}')
        for record_id in {r for _, r in pending}:
            refresh_record_index(record_id)
        self.stdout.write(f'Read {done} of {len(pending)} attachment(s).')
