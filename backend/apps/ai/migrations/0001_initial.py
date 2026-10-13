import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('records', '0004_trigram_search'),
    ]

    operations = [
        migrations.CreateModel(
            name='AiCallLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('feature', models.CharField(max_length=40)),
                ('provider', models.CharField(max_length=20)),
                ('model', models.CharField(blank=True, max_length=100)),
                ('external', models.BooleanField(default=False)),
                ('ok', models.BooleanField(default=True)),
                ('error', models.CharField(blank=True, max_length=300)),
                ('prompt_chars', models.PositiveIntegerField(default=0)),
                ('duration_ms', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('record', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ai_calls', to='records.record')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='ai_calls', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['-created_at'], name='ai_aicalllog_created_idx')],
            },
        ),
    ]
