import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('compliance', '0003_dispositionreview_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='destructioncertificate',
            name='rejected_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                                    related_name='rejected_destructions', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='destructioncertificate',
            name='rejected_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # A certificate that already breaks the rule cannot be fixed automatically; clear the approval so the
        # constraint can be added and the certificate has to be approved again by someone else.
        migrations.RunSQL(
            "UPDATE compliance_destructioncertificate "
            "SET approved_by_id = NULL, approved_at = NULL, status = 'pending' "
            "WHERE approved_by_id = authorised_by_id AND status = 'approved'",
            migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            "UPDATE compliance_destructioncertificate SET approved_by_id = NULL "
            "WHERE approved_by_id = authorised_by_id",
            migrations.RunSQL.noop,
        ),
        migrations.AddConstraint(
            model_name='destructioncertificate',
            constraint=models.CheckConstraint(
                check=models.Q(('approved_by', models.F('authorised_by')), _negated=True),
                name='destruction_approver_not_authoriser',
            ),
        ),
    ]
