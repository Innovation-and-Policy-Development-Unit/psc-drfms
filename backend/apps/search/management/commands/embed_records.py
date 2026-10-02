from django.core.management.base import BaseCommand

from apps.records.models import Record
from apps.search.embeddings import EmbeddingUnavailable, service_status
from apps.search.indexing import index_record


class Command(BaseCommand):
    help = 'Build or refresh the semantic-search index for existing records.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=0, help='Stop after this many records (0 = all).')

    def handle(self, *args, **opts):
        status = service_status()
        if not status['available']:
            hint = (
                'Set GEMINI_API_KEY in .env and restart the backend.'
                if status['provider'] == 'gemini'
                else 'Check that the Ollama server is running and has the model.'
            )
            self.stderr.write(self.style.ERROR(
                f"Embedding service is not ready ({status['provider']}, model {status['model']}). {hint}"
            ))
            return
        qs = Record.objects.filter(destroyed_at__isnull=True).order_by('created_at').values_list('pk', flat=True)
        if opts['limit']:
            qs = qs[:opts['limit']]
        done = chunks = 0
        for pk in qs:
            try:
                chunks += index_record(pk)
            except EmbeddingUnavailable as exc:
                self.stderr.write(self.style.ERROR(f'Stopped: {exc}'))
                break
            done += 1
            if done % 25 == 0:
                self.stdout.write(f'  {done} records indexed…')
        self.stdout.write(self.style.SUCCESS(f'Indexed {done} records ({chunks} passages).'))
