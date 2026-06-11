"""
Records API tests — upload, versioning, permissions, reference number uniqueness.

Run:  python manage.py test tests.test_records --settings=config.settings.development
"""
import io
import hashlib
from unittest.mock import patch

from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole
from apps.records.models import Record, RecordVersion, RecordSeries, DocumentPermission


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email, role=UserRole.RECORDS_OFFICER):
    return User.objects.create_user(
        email=email, username=email.split('@')[0],
        first_name='Test', last_name='User',
        password='Secur3Pass!', role=role,
    )


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def make_pdf():
    """Minimal valid PDF bytes."""
    return SimpleUploadedFile(
        'test.pdf', b'%PDF-1.4 test content', content_type='application/pdf'
    )


def make_record(user, **kwargs):
    defaults = dict(
        title='Test Record',
        document_type='policy',
        classification_level='internal',
        author=user,
        custodian=user,
    )
    defaults.update(kwargs)
    r = Record(**defaults)
    r.save()
    return r


# ---------------------------------------------------------------------------
# Reference number generation
# ---------------------------------------------------------------------------

class ReferenceNumberTests(TestCase):
    def test_reference_number_assigned_on_save(self):
        user = make_user('officer@psc.gov.vu')
        record = make_record(user)
        self.assertTrue(record.reference_number.startswith('PSC-'))

    def test_two_concurrent_saves_produce_unique_numbers(self):
        """Simulate two records saved in the same year — must be unique."""
        user = make_user('officer@psc.gov.vu')
        r1 = make_record(user, title='Record 1')
        r2 = make_record(user, title='Record 2')
        self.assertNotEqual(r1.reference_number, r2.reference_number)

    def test_explicit_reference_number_is_preserved(self):
        user = make_user('officer@psc.gov.vu')
        record = make_record(user, reference_number='CUSTOM-001')
        self.assertEqual(record.reference_number, 'CUSTOM-001')


# ---------------------------------------------------------------------------
# Record CRUD
# ---------------------------------------------------------------------------

class RecordCRUDTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.readonly = make_user('readonly@psc.gov.vu', UserRole.READ_ONLY)
        self.client = auth_client(self.officer)
        self.ro_client = auth_client(self.readonly)

    @patch('apps.records.serializers.process_record_ocr')
    def test_create_record_with_file(self, mock_ocr):
        mock_ocr.delay.return_value = None
        resp = self.client.post('/api/records/', {
            'title': 'Policy Document',
            'document_type': 'policy',
            'classification_level': 'internal',
            'file': make_pdf(),
            'change_summary': 'Initial upload',
        }, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', resp.data)
        self.assertTrue(Record.objects.filter(title='Policy Document').exists())

    def test_read_only_cannot_create(self):
        resp = self.ro_client.post('/api/records/', {
            'title': 'Test', 'document_type': 'policy',
            'classification_level': 'internal', 'file': make_pdf(),
        }, format='multipart')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_records_no_n_plus_one(self):
        """List endpoint should include version_count without extra queries per record."""
        for i in range(5):
            r = make_record(self.officer, title=f'Record {i}')
            RecordVersion.objects.create(
                record=r, version_number=1,
                file_name='f.pdf', file_size=100,
                mime_type='application/pdf',
                content_hash=hashlib.sha256(f'content{i}'.encode()).hexdigest(),
                created_by=self.officer,
            )
        # Capture query count — should be constant regardless of record count
        from django.test.utils import CaptureQueriesContext
        from django.db import connection
        with CaptureQueriesContext(connection) as ctx:
            resp = self.client.get('/api/records/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # All version counts should be in a single annotation query, not per record
        version_queries = [q for q in ctx.captured_queries if 'version' in q['sql'].lower()]
        # Should be 0 extra version queries (annotation folds into main query)
        self.assertEqual(len(version_queries), 0, 'Unexpected separate version queries detected — N+1 not fixed')

    def test_cannot_delete_vital_record(self):
        record = make_record(self.officer, is_vital=True)
        resp = self.client.delete(f'/api/records/{record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_delete_record_on_legal_hold(self):
        record = make_record(self.officer, is_on_legal_hold=True)
        resp = self.client.delete(f'/api/records/{record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_soft_delete_sets_destroyed_at(self):
        record = make_record(self.officer)
        resp = self.client.delete(f'/api/records/{record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        record.refresh_from_db()
        self.assertIsNotNone(record.destroyed_at)

    def test_destroyed_record_excluded_from_list(self):
        from django.utils import timezone
        record = make_record(self.officer)
        record.destroyed_at = timezone.now()
        record.save()
        resp = self.client.get('/api/records/')
        ids = [r['id'] for r in resp.data.get('results', resp.data)]
        self.assertNotIn(str(record.id), ids)


# ---------------------------------------------------------------------------
# File upload validation
# ---------------------------------------------------------------------------

class FileUploadValidationTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.client = auth_client(self.officer)
        self.record = make_record(self.officer)

    @patch('apps.records.views.process_record_ocr')
    @patch('apps.records.views.check_duplicate_on_upload')
    def test_valid_pdf_upload_succeeds(self, mock_dup, mock_ocr):
        mock_ocr.delay.return_value = None
        mock_dup.delay.return_value = None
        resp = self.client.post(
            f'/api/records/{self.record.id}/versions/',
            {'file': make_pdf(), 'change_summary': 'v2'},
            format='multipart',
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_disallowed_mime_type_rejected(self):
        bad_file = SimpleUploadedFile(
            'malware.exe', b'MZ\x90\x00', content_type='application/x-msdownload'
        )
        resp = self.client.post(
            f'/api/records/{self.record.id}/versions/',
            {'file': bad_file, 'change_summary': 'v2'},
            format='multipart',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not permitted', str(resp.data).lower())

    def test_oversized_file_rejected(self):
        from apps.records.serializers import MAX_UPLOAD_SIZE_BYTES
        big_file = SimpleUploadedFile(
            'big.pdf',
            b'%PDF' + b'x' * (MAX_UPLOAD_SIZE_BYTES + 1),
            content_type='application/pdf',
        )
        resp = self.client.post(
            f'/api/records/{self.record.id}/versions/',
            {'file': big_file, 'change_summary': 'v2'},
            format='multipart',
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('limit', str(resp.data).lower())


# ---------------------------------------------------------------------------
# Document-level permissions
# ---------------------------------------------------------------------------

class DocumentPermissionTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.reader = make_user('reader@psc.gov.vu', UserRole.READ_ONLY)
        self.officer_client = auth_client(self.officer)
        self.reader_client = auth_client(self.reader)

    def test_read_only_user_blocked_from_restricted_record(self):
        record = make_record(self.officer, classification_level='restricted')
        resp = self.reader_client.get(f'/api/records/{record.id}/')
        # READ_ONLY users can only see unclassified/internal by default
        # A restricted record without explicit permission should be 404 or 403
        self.assertIn(resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_read_only_can_view_internal_record(self):
        record = make_record(self.officer, classification_level='internal')
        resp = self.reader_client.get(f'/api/records/{record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_explicit_permission_grants_access_to_restricted(self):
        record = make_record(self.officer, classification_level='restricted')
        DocumentPermission.objects.create(
            record=record, user=self.reader,
            can_view=True, granted_by=self.officer,
        )
        resp = self.reader_client.get(f'/api/records/{record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Record detail serializer — no internal fields leaked
# ---------------------------------------------------------------------------

class RecordDetailSerializerTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.client = auth_client(self.officer)
        self.record = make_record(self.officer)

    def test_search_vector_not_in_response(self):
        resp = self.client.get(f'/api/records/{self.record.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotIn('search_vector', resp.data)

    def test_destroyed_at_not_in_response(self):
        resp = self.client.get(f'/api/records/{self.record.id}/')
        self.assertNotIn('destroyed_at', resp.data)
