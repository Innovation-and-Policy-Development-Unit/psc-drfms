import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('records', '0006_ai_summary_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='recordversion',
            name='thumbnail',
            field=models.ImageField(blank=True, upload_to='records/thumbnails/'),
        ),
        migrations.AddField(
            model_name='recordversion',
            name='thumbnail_failed',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='PinnedView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(max_length=80)),
                ('target', models.CharField(max_length=300)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pinned_views', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['created_at'],
                'unique_together': {('user', 'target')},
            },
        ),
    ]
