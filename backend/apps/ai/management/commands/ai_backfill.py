"""Give existing documents an AI summary and suggestions, gently.

Only each record's latest version is considered. Versions that already have a
current summary are skipped, so the command is safe to run repeatedly and to stop
and restart. The delay between calls keeps free-tier rate limits happy.

  python manage.py ai_backfill --dry-run
  python manage.py ai_backfill --limit 20 --delay 6
"""
import time

from django.core.management.base import BaseCommand

from apps.ai import llm
from apps.ai.llm import LLMUnavailable
from apps.ai.tasks import mark_summary_failed, run_analysis, run_summary
from apps.records.models import RecordVersion

MAX_CONSECUTIVE_FAILURES = 5


class Command(BaseCommand):
    help = 'Write AI summaries (and suggestions) for existing documents that have none.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=50, help='Most versions to process this run (default 50)')
        parser.add_argument('--delay', type=float, default=6.0, help='Seconds to wait between calls (default 6)')
        parser.add_argument('--dry-run', action='store_true', help='Only report what would be done')

    def candidates(self):
        pending_or_missing = RecordVersion.objects.filter(
            record__destroyed_at__isnull=True, ai_summary='',
        ).exclude(ocr_text='').exclude(ai_summary_status='pending').select_related('record').order_by('-created_at')
        for v in pending_or_missing.iterator():
            latest = v.record.versions.order_by('-version_number').values_list('pk', flat=True).first()
            if latest == v.pk:
                yield v

    def handle(self, *args, **opts):
        if not llm.is_enabled():
            self.stderr.write('AI is not configured (LLM_PROVIDER). Nothing to do.')
            return
        todo, skipped = [], 0
        for v in self.candidates():
            if llm.provider_for(v.record.classification_level) is None:
                skipped += 1  # classification does not allow AI to read it
                continue
            todo.append(v)
        self.stdout.write(f'{len(todo)} document(s) need a summary; {skipped} skipped (classification not permitted).')
        if opts['dry_run']:
            return

        done = failed = streak = 0
        for v in todo[:opts['limit']]:
            try:
                (run_summary if v.ai_engine else run_analysis)(v.pk)
                RecordVersion.objects.filter(pk=v.pk, ai_summary='', ai_summary_status='pending').update(ai_summary_status='failed')
                done += 1
                streak = 0
                self.stdout.write(f'  ok      {v.record.reference_number}  {v.record.title[:60]}')
            except LLMUnavailable as exc:
                mark_summary_failed(v.pk)
                failed += 1
                streak += 1
                self.stdout.write(f'  failed  {v.record.reference_number}: {exc}')
                if streak >= MAX_CONSECUTIVE_FAILURES:
                    self.stderr.write('Stopping: the AI service keeps failing. Run again later.')
                    break
            time.sleep(opts['delay'])
        remaining = max(len(todo) - done - failed, 0)
        self.stdout.write(f'Done: {done} written, {failed} failed, {remaining} not attempted.')
