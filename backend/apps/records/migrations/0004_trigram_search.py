from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Typo-tolerant search: pg_trgm + trigram indexes on title and reference."""

    dependencies = [
        ('records', '0003_merge_recordstar_refsequence'),
    ]

    operations = [
        TrigramExtension(),
        migrations.AddIndex(
            model_name='record',
            index=GinIndex(fields=['title'], name='record_title_trgm', opclasses=['gin_trgm_ops']),
        ),
        migrations.AddIndex(
            model_name='record',
            index=GinIndex(fields=['reference_number'], name='record_ref_trgm', opclasses=['gin_trgm_ops']),
        ),
    ]
