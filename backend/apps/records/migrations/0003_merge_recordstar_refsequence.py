from django.db import migrations


class Migration(migrations.Migration):
    """Merge parallel 0002 branches (refsequence + recordstar)."""

    dependencies = [
        ('records', '0002_refsequence'),
        ('records', '0002_recordstar'),
    ]

    operations = []
