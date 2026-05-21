from django.db import migrations


class Migration(migrations.Migration):
    """
    Create a lightweight reference-number sequence table used by
    Record._next_sequence() to avoid the count+1 race condition under
    concurrent inserts.
    """

    dependencies = [
        ('records', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE TABLE IF NOT EXISTS records_refsequence (
                    year        SMALLINT PRIMARY KEY,
                    last_value  INTEGER  NOT NULL DEFAULT 0
                );
            """,
            reverse_sql="DROP TABLE IF EXISTS records_refsequence;",
        ),
    ]
