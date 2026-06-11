from django.core.management.base import BaseCommand

from apps.compliance.tasks import scan_retention_due


class Command(BaseCommand):
    help = 'Run the retention disposition scan synchronously (same job Celery beat runs nightly).'

    def handle(self, *args, **options):
        result = scan_retention_due()
        self.stdout.write(self.style.SUCCESS(
            f"Retention scan complete: {result['backfilled']} retention dates backfilled, "
            f"{result['flagged']} records flagged for disposition review."
        ))
