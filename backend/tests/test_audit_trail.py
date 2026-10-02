"""
Creating and editing a record must leave an audit entry.

Run:  python manage.py test tests.test_audit_trail --settings=config.settings.development
"""
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.audit.models import AuditLog
from apps.records.models import Record


def make_user(email, role):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name='T', last_name='U',
        password='Secur3Pass!', role=role,
    )


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class RecordAuditTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY)
        self.record = Record.objects.create(
            title='Original title', description='', classification_level='internal',
            custodian=self.officer, author=self.officer,
        )

    def test_editing_logs_changed_field_names_not_values(self):
        res = client_for(self.officer).patch(
            f'/api/records/{self.record.pk}/', {'title': 'New title', 'description': 'secret detail'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        entry = AuditLog.objects.get(action='update', record=self.record)
        self.assertEqual(entry.user, self.officer)
        self.assertEqual(entry.extra, {'fields': ['description', 'title']})
        self.assertNotIn('secret detail', str(entry.extra))

    def test_saving_without_changes_logs_no_update(self):
        client_for(self.officer).patch(f'/api/records/{self.record.pk}/', {'title': 'Original title'}, format='json')
        self.assertFalse(AuditLog.objects.filter(action='update').exists())

    def test_refused_edit_logs_no_update(self):
        res = client_for(self.reader).patch(f'/api/records/{self.record.pk}/', {'title': 'Hacked'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertFalse(AuditLog.objects.filter(action='update').exists())
        self.record.refresh_from_db()
        self.assertEqual(self.record.title, 'Original title')

    def test_creating_logs_a_create_entry_with_the_reference(self):
        pdf = SimpleUploadedFile('a.pdf', b'%PDF-1.4 x', content_type='application/pdf')
        with patch('apps.records.tasks.process_record_ocr.delay'):
            res = client_for(self.officer).post(
                '/api/records/', {'title': 'Brand new', 'document_type': 'policy', 'file': pdf}, format='multipart',
            )
        self.assertEqual(res.status_code, 201)
        entry = AuditLog.objects.get(action='create')
        self.assertEqual(entry.user, self.officer)
        self.assertEqual(entry.record.title, 'Brand new')
        self.assertEqual(entry.record_reference, entry.record.reference_number)
