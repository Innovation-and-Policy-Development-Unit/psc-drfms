from django.db import migrations, models
import django.utils.timezone


def backfill_chain(apps, schema_editor):
    """Give rows written before the chain existed a snapshot of who/what and a place in the chain."""
    from datetime import timezone as dt_tz

    from apps.audit import chain

    AuditLog = apps.get_model('audit', 'AuditLog')
    prev = chain.GENESIS
    rows = AuditLog.objects.select_related('user').order_by('timestamp', 'id')
    for seq, row in enumerate(rows.iterator(chunk_size=500), start=1):
        email = row.user.email if row.user_id else ''
        name = f'{row.user.first_name} {row.user.last_name}'.strip() if row.user_id else ''
        payload = chain.canonical_payload(
            seq=seq, id=row.id, user_email=email, user_name=name, action=row.action,
            record_reference=row.record_reference,
            ip_address=str(row.ip_address) if row.ip_address else '',
            user_agent=row.user_agent, extra=row.extra,
            timestamp=row.timestamp.astimezone(dt_tz.utc),
        )
        digest = chain.compute_hash(prev, payload)
        AuditLog.objects.filter(pk=row.pk).update(
            seq=seq, user_email=email, user_name=name, prev_hash=prev, hash=digest,
        )
        prev = digest


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0003_recycle_bin_audit'),
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditlog', name='user_email',
            field=models.CharField(blank=True, max_length=254, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='auditlog', name='user_name',
            field=models.CharField(blank=True, max_length=300, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='auditlog', name='seq',
            field=models.BigIntegerField(blank=True, editable=False, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='auditlog', name='prev_hash',
            field=models.CharField(blank=True, editable=False, max_length=64, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='auditlog', name='hash',
            field=models.CharField(blank=True, editable=False, max_length=64, default=''),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='auditlog', name='timestamp',
            field=models.DateTimeField(default=django.utils.timezone.now, editable=False),
        ),
        migrations.RunPython(backfill_chain, migrations.RunPython.noop),
    ]
