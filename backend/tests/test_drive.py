"""
File-browser support: list columns/sorting/filters, thumbnails, storage meter, pins, blank documents.

Run:  python manage.py test tests.test_drive --settings=config.settings.development
"""
import io
import shutil
import tempfile
import zipfile
from datetime import date

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.records.models import PinnedView, Record, RecordSeries, RecordVersion
from apps.sharing.models import SharedLink

TMP_MEDIA = tempfile.mkdtemp(prefix='drfms-test-media-')
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


def make_user(email, role):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name='T', last_name='U',
        password='Secur3Pass!', role=role,
    )


def make_record(owner, title, mime='application/pdf', content=b'x', **kwargs):
    rec = Record.objects.create(title=title, custodian=owner, author=owner, **kwargs)
    ext = {'application/pdf': 'pdf', 'image/png': 'png'}.get(mime, 'docx')
    version = RecordVersion(
        record=rec, version_number=1, file_name=f'f.{ext}', file_size=len(content), mime_type=mime,
        content_hash=str(rec.pk), created_by=owner,
    )
    version.file.save(f'f.{ext}', ContentFile(content), save=False)
    version.save()
    return rec


def pdf_bytes():
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), 'Hello thumbnail')
    return doc.tobytes()


def png_bytes():
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', (800, 1000), 'white').save(buf, format='PNG')
    return buf.getvalue()


@override_settings(STORAGES=STORAGES, MEDIA_ROOT=TMP_MEDIA)
class DriveTestCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.officer = make_user('o@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY)
        self.client = APIClient()
        self.client.force_authenticate(self.officer)


class ListColumnsAndFiltersTests(DriveTestCase):
    def setUp(self):
        super().setUp()
        self.a = make_record(self.officer, 'Alpha budget', content=b'a' * 10, classification_level='internal',
                             originating_ministry='Ministry of Finance', document_date=date(2024, 5, 1),
                             retention_date=date(2031, 5, 1))
        self.b = make_record(self.officer, 'Beta report', mime='image/png', content=b'b' * 500,
                             classification_level='confidential', originating_ministry='Ministry of Health',
                             document_date=date(2023, 2, 2))
        self.c = make_record(self.officer, 'Gamma minutes', mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                             content=b'c' * 100, classification_level='unclassified')

    def _titles(self, **params):
        data = self.client.get('/api/records/', params).json()
        return [r['title'] for r in data['results']]

    def test_list_exposes_retention_preview_and_sharing(self):
        RecordVersion.objects.filter(record=self.a).update(ai_summary='x' * 300)
        SharedLink.objects.create(record=self.a, token='t' * 20, created_by=self.officer)
        rows = {r['title']: r for r in self.client.get('/api/records/').json()['results']}
        self.assertEqual(rows['Alpha budget']['retentionDate'], '2031-05-01')
        self.assertEqual(len(rows['Alpha budget']['summaryPreview']), 160)
        self.assertTrue(rows['Alpha budget']['isShared'])
        self.assertFalse(rows['Beta report']['isShared'])

    def test_sorting_by_new_columns(self):
        self.assertEqual(self._titles(ordering='file_size')[0], 'Alpha budget')
        self.assertEqual(self._titles(ordering='-file_size')[0], 'Beta report')
        # classification sorts by sensitivity, not alphabetically
        self.assertEqual(self._titles(ordering='classification_rank'), ['Gamma minutes', 'Alpha budget', 'Beta report'])
        self.assertEqual(self._titles(ordering='reference_number')[0], 'Alpha budget')
        self.assertEqual(len(self._titles(ordering='-retention_date')), 3)

    def test_filters(self):
        self.assertEqual(self._titles(originating_ministry='Ministry of Health'), ['Beta report'])
        self.assertEqual(self._titles(year='2024'), ['Alpha budget'])
        self.assertEqual(self._titles(file_type='pdf'), ['Alpha budget'])
        self.assertEqual(self._titles(file_type='image'), ['Beta report'])
        self.assertEqual(self._titles(file_type='word'), ['Gamma minutes'])
        self.assertEqual(self._titles(file_type='nonsense').__len__(), 3)  # unknown value is ignored

    def test_search_offers_custodian_facet_and_filter(self):
        data = self.client.get('/api/search/', {'q': 'Alpha'}).json()
        self.assertEqual(data['facets']['custodian'][0]['value'], str(self.officer.pk))
        data = self.client.get('/api/search/', {'q': 'Alpha', 'custodian': str(self.officer.pk)}).json()
        self.assertEqual(data['count'], 1)


class ThumbnailTests(DriveTestCase):
    def test_pdf_and_image_thumbnails_are_rendered_once_and_stored(self):
        pdf = make_record(self.officer, 'PDF', content=pdf_bytes(), classification_level='internal')
        res = self.client.get(f'/api/records/{pdf.pk}/thumbnail/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'image/jpeg')
        self.assertTrue(res.content.startswith(b'\xff\xd8'))
        version = pdf.versions.first()
        version.refresh_from_db()
        self.assertTrue(version.thumbnail.name)
        self.assertEqual(self.client.get(f'/api/records/{pdf.pk}/thumbnail/').status_code, 200)  # from storage

        img = make_record(self.officer, 'PNG', mime='image/png', content=png_bytes(), classification_level='internal')
        self.assertEqual(self.client.get(f'/api/records/{img.pk}/thumbnail/')['Content-Type'], 'image/jpeg')

    def test_unsupported_and_broken_files_give_204_and_are_not_retried(self):
        doc = make_record(self.officer, 'Doc', mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          classification_level='internal')
        self.assertEqual(self.client.get(f'/api/records/{doc.pk}/thumbnail/').status_code, 204)
        bad = make_record(self.officer, 'Bad PDF', content=b'not a pdf', classification_level='internal')
        self.assertEqual(self.client.get(f'/api/records/{bad.pk}/thumbnail/').status_code, 204)
        self.assertTrue(bad.versions.first().thumbnail_failed)

    def test_thumbnail_requires_view_permission(self):
        secret = make_record(self.officer, 'Secret', content=pdf_bytes(), classification_level='secret')
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.get(f'/api/records/{secret.pk}/thumbnail/').status_code, 403)


class StorageMeterTests(DriveTestCase):
    def test_reports_bytes_the_user_can_see_and_optional_quota(self):
        make_record(self.officer, 'A', content=b'a' * 1000, classification_level='internal')
        make_record(self.officer, 'Hidden', content=b'b' * 5000, classification_level='secret')
        self.client.force_authenticate(self.reader)
        data = self.client.get('/api/records/storage/').json()
        self.assertEqual(data['usedBytes'], 1000)
        self.assertEqual(data['recordCount'], 1)
        self.assertIsNone(data['quotaBytes'])

    @override_settings(STORAGE_QUOTA_GB=2)
    def test_quota(self):
        from django.core.cache import cache
        cache.clear()
        self.assertEqual(self.client.get('/api/records/storage/').json()['quotaBytes'], 2 * 1024 ** 3)


class PinTests(DriveTestCase):
    def test_pin_create_dedupe_list_delete_and_isolation(self):
        res = self.client.post('/api/records/pins/', {'label': 'Finance', 'target': '/browse?record_series=3'}, format='json')
        self.assertEqual(res.status_code, 201)
        again = self.client.post('/api/records/pins/', {'label': 'Finance again', 'target': '/browse?record_series=3'}, format='json')
        self.assertEqual(again.json()['id'], res.json()['id'])
        self.assertEqual(len(self.client.get('/api/records/pins/').json()), 1)
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.get('/api/records/pins/').json(), [])
        self.assertEqual(self.client.delete(f"/api/records/pins/{res.json()['id']}/").status_code, 404)
        self.client.force_authenticate(self.officer)
        self.assertEqual(self.client.delete(f"/api/records/pins/{res.json()['id']}/").status_code, 204)

    def test_only_in_app_paths_are_accepted(self):
        for target in ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', 'browse', '/auth/login', '/a b', '/x\\y']:
            res = self.client.post('/api/records/pins/', {'label': 'X', 'target': target}, format='json')
            self.assertEqual(res.status_code, 400, target)
        self.assertEqual(PinnedView.objects.count(), 0)

    def test_limit(self):
        for i in range(25):
            PinnedView.objects.create(user=self.officer, label=f'p{i}', target=f'/browse?page={i}')
        res = self.client.post('/api/records/pins/', {'label': 'one more', 'target': '/recent'}, format='json')
        self.assertEqual(res.status_code, 400)


class NewDocumentTests(DriveTestCase):
    def test_each_kind_creates_a_record_with_a_valid_package(self):
        expect = {'word': 'word/document.xml', 'excel': 'xl/workbook.xml', 'powerpoint': 'ppt/presentation.xml'}
        for kind, part in expect.items():
            res = self.client.post('/api/records/new-document/', {'kind': kind, 'title': f'My {kind} file'}, format='json')
            self.assertEqual(res.status_code, 201, kind)
            record = Record.objects.get(pk=res.json()['id'])
            version = record.versions.get()
            self.assertEqual(record.custodian, self.officer)
            with version.file.open('rb') as fh, zipfile.ZipFile(io.BytesIO(fh.read())) as z:
                self.assertIn(part, z.namelist())
                self.assertIsNone(z.testzip())

    def test_validation_and_permissions(self):
        self.assertEqual(self.client.post('/api/records/new-document/', {'kind': 'pdf'}, format='json').status_code, 400)
        self.client.force_authenticate(self.reader)
        self.assertEqual(self.client.post('/api/records/new-document/', {'kind': 'word'}, format='json').status_code, 403)

    def test_series_is_applied(self):
        series = RecordSeries.objects.create(code='FIN', name='Finance', retention_years=7)
        res = self.client.post('/api/records/new-document/', {'kind': 'word', 'title': 'Budget', 'record_series': series.pk}, format='json')
        self.assertEqual(Record.objects.get(pk=res.json()['id']).record_series, series)
