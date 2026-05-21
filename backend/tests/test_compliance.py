"""
Compliance tests — legal holds, retention schedules, destruction certificates.

Run:  python manage.py test tests.test_compliance --settings=config.settings.development
"""
from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole
from apps.records.models import Record
from apps.compliance.models import LegalHold, DestructionCertificate, RetentionSchedule
from apps.records.models import RecordSeries


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email, role=UserRole.RECORDS_OFFICER):
    return User.objects.create_user(
        email=email, username=email.split('@')[0],
        first_name='T', last_name='U',
        password='Secur3Pass!', role=role,
    )


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def make_record(user, **kwargs):
    defaults = dict(
        title='Test Record', document_type='policy',
        classification_level='internal',
        author=user, custodian=user,
    )
    defaults.update(kwargs)
    r = Record(**defaults)
    r.save()
    return r


# ---------------------------------------------------------------------------
# Legal hold tests
# ---------------------------------------------------------------------------

class LegalHoldTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.director = make_user('director@psc.gov.vu', UserRole.DIRECTOR)
        self.officer_client = auth_client(self.officer)
        self.director_client = auth_client(self.director)
        self.record = make_record(self.officer)

    def test_officer_can_create_legal_hold(self):
        resp = self.officer_client.post('/api/compliance/legal-holds/', {
            'title': 'Inquiry Hold',
            'reason': 'Commission inquiry',
            'hold_type': 'inquiry',
            'records': [str(self.record.id)],
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.record.refresh_from_db()
        self.assertTrue(self.record.is_on_legal_hold)

    def test_read_only_cannot_create_legal_hold(self):
        readonly = make_user('ro@psc.gov.vu', UserRole.READ_ONLY)
        resp = auth_client(readonly).post('/api/compliance/legal-holds/', {
            'title': 'Hold', 'reason': 'Test', 'hold_type': 'other',
            'records': [str(self.record.id)],
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_director_can_lift_hold(self):
        hold = LegalHold.objects.create(
            title='Test Hold', reason='Test', hold_type='audit',
            applied_by=self.officer, is_active=True,
        )
        hold.records.add(self.record)
        self.record.is_on_legal_hold = True
        self.record.save()

        resp = self.director_client.post(f'/api/compliance/legal-holds/{hold.id}/lift/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        hold.refresh_from_db()
        self.assertFalse(hold.is_active)

    def test_cannot_delete_record_under_legal_hold(self):
        self.record.is_on_legal_hold = True
        self.record.save()
        resp = self.officer_client.delete(f'/api/records/{self.record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_lifting_hold_marks_record_if_no_other_active_holds(self):
        hold = LegalHold.objects.create(
            title='Single Hold', reason='Test', hold_type='audit',
            applied_by=self.officer, is_active=True,
        )
        hold.records.add(self.record)
        self.record.is_on_legal_hold = True
        self.record.save()
        hold.lift(self.director)
        self.record.refresh_from_db()
        self.assertFalse(self.record.is_on_legal_hold)


# ---------------------------------------------------------------------------
# Destruction certificate tests
# ---------------------------------------------------------------------------

class DestructionCertificateTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.director = make_user('director@psc.gov.vu', UserRole.DIRECTOR)
        self.officer_client = auth_client(self.officer)
        self.director_client = auth_client(self.director)

    def test_officer_can_create_certificate(self):
        resp = self.officer_client.post('/api/compliance/destruction/', {
            'destruction_method': 'Secure digital deletion',
            'notes': 'Retention period expired',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['certificate_number'].startswith('DC-'))

    def test_certificate_number_auto_generated(self):
        cert = DestructionCertificate.objects.create(
            authorised_by=self.officer,
            destruction_method='deletion',
        )
        self.assertRegex(cert.certificate_number, r'^DC-\d{4}-\d{4}$')

    def test_director_can_approve_certificate(self):
        cert = DestructionCertificate.objects.create(
            authorised_by=self.officer,
            destruction_method='deletion',
            status='pending',
        )
        resp = self.director_client.post(
            f'/api/compliance/destruction/{cert.id}/approve/',
            {'action': 'approve'},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        cert.refresh_from_db()
        self.assertEqual(cert.status, 'approved')

    def test_director_can_reject_certificate(self):
        cert = DestructionCertificate.objects.create(
            authorised_by=self.officer,
            destruction_method='deletion',
            status='pending',
        )
        resp = self.director_client.post(
            f'/api/compliance/destruction/{cert.id}/approve/',
            {'action': 'reject'},
        )
        cert.refresh_from_db()
        self.assertEqual(cert.status, 'rejected')


# ---------------------------------------------------------------------------
# Retention schedule tests
# ---------------------------------------------------------------------------

class RetentionScheduleTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@psc.gov.vu', UserRole.ADMINISTRATOR)
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.admin_client = auth_client(self.admin)
        self.officer_client = auth_client(self.officer)
        self.series = RecordSeries.objects.create(
            code='HRM-001', name='HR Management', retention_years=7
        )

    def test_admin_can_create_retention_schedule(self):
        resp = self.admin_client.post('/api/compliance/retention/', {
            'record_series': self.series.pk,
            'retention_years': 10,
            'disposition_action': 'archive',
            'statutory_basis': 'Public Service Act s.45',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_officer_cannot_create_retention_schedule(self):
        resp = self.officer_client.post('/api/compliance/retention/', {
            'record_series': self.series.pk,
            'retention_years': 5,
            'disposition_action': 'destroy',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_overdue_records_view_excludes_vital_and_held(self):
        director = make_user('dir@psc.gov.vu', UserRole.DIRECTOR)
        director_client = auth_client(director)
        past_date = date.today() - timedelta(days=1)

        overdue = make_record(self.officer, retention_date=past_date)
        vital_overdue = make_record(self.officer, retention_date=past_date, is_vital=True)
        held_overdue = make_record(self.officer, retention_date=past_date, is_on_legal_hold=True)

        resp = director_client.get('/api/compliance/overdue/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        returned_ids = [r['id'] for r in resp.data]
        self.assertIn(str(overdue.id), returned_ids)
        self.assertNotIn(str(vital_overdue.id), returned_ids)
        self.assertNotIn(str(held_overdue.id), returned_ids)
