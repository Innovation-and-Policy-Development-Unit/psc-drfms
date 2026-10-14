"""
Recycle bin: delete moves a record out of reach, restore brings it back unchanged,
and nothing is ever erased from the bin.

Run:  python manage.py test tests.test_recycle_bin --settings=config.settings.development
"""
import importlib
from datetime import date

from django.apps import apps as django_apps
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.audit.models import AuditAction, AuditLog
from apps.records.models import Record, RecordSeries
from apps.sharing.models import SharedLink


def make_user(email, role):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name='T', last_name=role.label,
        password='Secur3Pass!', role=role,
    )


def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class RecycleBinTests(TestCase):
    def setUp(self):
        self.officer = make_user('o@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.other_officer = make_user('o2@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.admin = make_user('a@t.gov.vu', UserRole.ADMINISTRATOR)
        self.reader = make_user('r@t.gov.vu', UserRole.READ_ONLY)
        self.series = RecordSeries.objects.create(code='HR', name='HR', retention_years=10)
        self.record = Record.objects.create(
            title='Leave policy', custodian=self.officer, author=self.officer, classification_level='internal',
            record_series=self.series, retention_date=date(2034, 1, 1), tags=['leave'],
        )
        self.client = api(self.officer)

    def _delete(self, record=None, client=None):
        return (client or self.client).delete(f'/api/records/{(record or self.record).pk}/')

    def _ids(self, url='/api/records/'):
        return [r['id'] for r in self.client.get(url).json()['results']]

    def test_delete_moves_the_record_to_the_bin_and_out_of_reach(self):
        self.assertEqual(self._delete().status_code, 204)
        self.record.refresh_from_db()
        self.assertIsNotNone(self.record.deleted_at)
        self.assertEqual(self.record.deleted_by, self.officer)
        self.assertEqual(self.record.destroyed_at, self.record.deleted_at)
        self.assertNotIn(str(self.record.pk), self._ids())
        self.assertEqual(self.client.get('/api/search/', {'q': 'Leave'}).json()['count'], 0)
        for url in (f'/api/records/{self.record.pk}/', f'/api/records/{self.record.pk}/thumbnail/', f'/api/records/{self.record.pk}/versions/'):
            self.assertEqual(self.client.get(url).status_code, 404, url)
        self.assertTrue(AuditLog.objects.filter(record=self.record, action='delete', extra__recycle_bin=True).exists())

    def test_bin_lists_it_and_restore_brings_it_back_unchanged(self):
        self._delete()
        data = self.client.get('/api/records/bin/').json()
        self.assertEqual(data['count'], 1)
        row = data['results'][0]
        self.assertEqual((row['id'], row['title'], row['recordSeriesName']), (str(self.record.pk), 'Leave policy', 'HR'))
        self.assertEqual(row['deletedByName'], self.officer.get_full_name())

        res = self.client.post('/api/records/bin/restore/', {'record_ids': [str(self.record.pk)]}, format='json').json()
        self.assertEqual((res['count'], res['failed']), (1, []))
        self.record.refresh_from_db()
        self.assertIsNone(self.record.deleted_at)
        self.assertIsNone(self.record.destroyed_at)
        self.assertIsNone(self.record.deleted_by)
        self.assertEqual((self.record.record_series, self.record.retention_date, self.record.tags), (self.series, date(2034, 1, 1), ['leave']))
        self.assertIn(str(self.record.pk), self._ids())
        self.assertEqual(self.client.get(f'/api/records/{self.record.pk}/').status_code, 200)
        self.assertEqual(self.client.get('/api/records/bin/').json()['count'], 0)
        self.assertTrue(AuditLog.objects.filter(record=self.record, action=AuditAction.RESTORE).exists())

    def test_protected_records_cannot_be_deleted(self):
        Record.objects.filter(pk=self.record.pk).update(is_on_legal_hold=True)
        self.assertEqual(self._delete().status_code, 403)
        Record.objects.filter(pk=self.record.pk).update(is_on_legal_hold=False, is_vital=True)
        self.assertEqual(self._delete().status_code, 403)
        self.assertEqual(self.client.get('/api/records/bin/').json()['count'], 0)

    def test_read_only_users_cannot_use_the_bin(self):
        self._delete()
        reader = api(self.reader)
        self.assertEqual(reader.get('/api/records/bin/').status_code, 403)
        self.assertEqual(reader.post('/api/records/bin/restore/', {'record_ids': [str(self.record.pk)]}, format='json').status_code, 403)

    def test_colleagues_see_and_restore_each_others_deletions_within_their_clearance(self):
        self._delete()
        other = api(self.other_officer)
        self.assertEqual(other.get('/api/records/bin/').json()['count'], 1)
        res = other.post('/api/records/bin/restore/', {'record_ids': [str(self.record.pk)]}, format='json').json()
        self.assertEqual(res['count'], 1)

    def test_clearance_still_applies_inside_the_bin(self):
        secret = Record.objects.create(title='Secret memo', custodian=self.admin, author=self.admin, classification_level='secret')
        self._delete(secret, client=api(self.admin))
        self.assertEqual(self.client.get('/api/records/bin/').json()['count'], 0)  # an officer cannot see it
        res = self.client.post('/api/records/bin/restore/', {'record_ids': [str(secret.pk)]}, format='json').json()
        self.assertEqual(res['count'], 0)
        self.assertEqual(api(self.admin).get('/api/records/bin/').json()['count'], 1)

    def test_restore_reports_ids_that_are_not_in_the_bin(self):
        res = self.client.post('/api/records/bin/restore/', {'record_ids': [str(self.record.pk)]}, format='json').json()
        self.assertEqual(res['count'], 0)
        self.assertEqual(res['failed'][0]['detail'], 'Not found in the Recycle bin.')
        self.assertEqual(self.client.post('/api/records/bin/restore/', {'record_ids': []}, format='json').status_code, 400)

    def test_records_destroyed_by_certificate_never_appear_in_the_bin(self):
        from apps.compliance.models import DestructionCertificate
        cert = DestructionCertificate.objects.create(authorised_by=self.admin)
        Record.objects.filter(pk=self.record.pk).update(
            deleted_at=timezone.now(), destroyed_at=timezone.now(), destruction_certificate=cert)
        self.assertEqual(self.client.get('/api/records/bin/').json()['count'], 0)

    def test_shared_links_stop_working_while_binned_and_resume_after_restore(self):
        link = SharedLink.objects.create(record=self.record, created_by=self.officer)
        public = APIClient()
        self.assertEqual(public.get(f'/api/sharing/{link.token}/view/').status_code, 200)
        self._delete()
        self.assertEqual(public.get(f'/api/sharing/{link.token}/view/').status_code, 403)
        self.client.post('/api/records/bin/restore/', {'record_ids': [str(self.record.pk)]}, format='json')
        self.assertEqual(public.get(f'/api/sharing/{link.token}/view/').status_code, 200)

    def test_search_filter_in_the_bin(self):
        other = Record.objects.create(title='Budget', custodian=self.officer, author=self.officer, classification_level='internal')
        self._delete()
        self._delete(other)
        self.assertEqual(self.client.get('/api/records/bin/', {'q': 'budget'}).json()['count'], 1)

    def test_migration_turns_earlier_deletions_into_bin_items(self):
        migration = importlib.import_module('apps.records.migrations.0008_recycle_bin')
        when = timezone.now()
        Record.objects.filter(pk=self.record.pk).update(destroyed_at=when)  # how a delete used to look
        migration.existing_deletions_become_bin_items(django_apps, None)
        self.record.refresh_from_db()
        self.assertEqual(self.record.deleted_at, when)
        self.assertEqual(self.client.get('/api/records/bin/').json()['count'], 1)
