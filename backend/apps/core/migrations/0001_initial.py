import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AppearanceSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('default_theme', models.CharField(default='psc-blue', max_length=32)),
                ('default_mode', models.CharField(default='light', max_length=10)),
                ('default_density', models.CharField(default='comfortable', max_length=12)),
                ('default_radius', models.CharField(default='default', max_length=10)),
                ('locked', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Appearance settings',
                'verbose_name_plural': 'Appearance settings',
            },
        ),
    ]
