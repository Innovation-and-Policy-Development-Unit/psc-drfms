import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def existing_deletions_become_bin_items(apps, schema_editor):
    """Until now only the Delete button ever set destroyed_at, so those records are bin items."""
    Record = apps.get_model('records', 'Record')
    Record.objects.filter(destroyed_at__isnull=False, destruction_certificate__isnull=True, deleted_at__isnull=True).update(
        deleted_at=models.F('destroyed_at'),
    )


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('records', '0007_thumbnails_pinned_views'),
    ]

    operations = [
        migrations.AddField(
            model_name='record',
            name='deleted_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='record',
            name='deleted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deleted_records', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(existing_deletions_become_bin_items, migrations.RunPython.noop),
    ]
