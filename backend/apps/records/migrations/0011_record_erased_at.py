from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('records', '0010_attachments_search_promote'),
    ]

    operations = [
        migrations.AddField(
            model_name='record',
            name='erased_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
