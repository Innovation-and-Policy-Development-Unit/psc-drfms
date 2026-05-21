from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('correspondence', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS correspondence_refsequence (
                    year        SMALLINT PRIMARY KEY,
                    last_value  INTEGER  NOT NULL DEFAULT 0
                );
            """,
            reverse_sql="DROP TABLE IF EXISTS correspondence_refsequence;",
        ),
    ]
