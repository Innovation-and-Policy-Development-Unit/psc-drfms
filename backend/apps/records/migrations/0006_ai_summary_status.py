from django.db import migrations, models


def mark_existing_summaries_ready(apps, schema_editor):
    RecordVersion = apps.get_model('records', 'RecordVersion')
    RecordVersion.objects.exclude(ai_summary='').update(ai_summary_status='ready')


class Migration(migrations.Migration):

    dependencies = [
        ('records', '0005_ai_summary_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='recordversion',
            name='ai_summary_status',
            field=models.CharField(blank=True, max_length=10),
        ),
        migrations.AddField(
            model_name='recordversion',
            name='ai_summary_hash',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.RunPython(mark_existing_summaries_ready, migrations.RunPython.noop),
    ]
