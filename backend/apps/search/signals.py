from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.records.models import Record


@receiver(post_save, sender=Record)
def queue_record_embedding(sender, instance, **kwargs):
    """Keep the semantic index in step when a record is created or edited."""
    if not settings.SEMANTIC_SEARCH_ENABLED:
        return
    from .tasks import embed_record
    transaction.on_commit(lambda: embed_record.delay(str(instance.pk)))
