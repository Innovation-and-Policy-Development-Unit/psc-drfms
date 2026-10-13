from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('records', '0004_trigram_search'),
    ]

    operations = [
        migrations.AddField(
            model_name='recordversion',
            name='ai_summary',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='recordversion',
            name='ai_engine',
            field=models.CharField(blank=True, max_length=80),
        ),
        migrations.AddField(
            model_name='recordversion',
            name='ai_review_status',
            field=models.CharField(blank=True, db_index=True, max_length=20),
        ),
    ]
