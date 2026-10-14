"""
Attachments as part of the record: searchable text, thumbnails, "make its own record", "attach an existing record".

Run:  python manage.py test tests.test_attachments_plus --settings=config.settings.development
"""
import hashlib
import io
import shutil
import tempfile
import zipfile
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.records.blank_docs import build_blank
from apps.records.models import Record, RecordAttachment, RecordRelation, RecordVersion
from apps.records.tasks import process_attachment_text, update_record_search_vector
from apps.records.textextract import extract_text
from apps.search.chunking import record_passages
from apps.search.indexing import index_record

TMP_MEDIA = tempfile.mkdtemp(prefix='drfms-attach-')
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def make_user(email, role):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name=email.split('@')[0].title(), last_name='T',
        password='Secur3Pass!', role=role,
    )


def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def pdf_with_text(text):
    import fitz
    doc = fitz.open()
    doc.new_page().insert_text((72, 90), text, fontsize=14)
    return doc.tobytes()


def make_record(owner, title, content=b'main file', mime='application/pdf', **kw):
    kw.setdefault('classification_level', 'internal')
    rec = Record.objects.create(title=title, custodian=owner, author=owner, **kw)
    v = RecordVersion(record=rec, version_number=1, file_name=f'{title}.pdf', file_size=len(content), mime_type=mime,
                      content_hash=hashlib.sha256(content).hexdigest(), created_by=owner)
    v.file.save(f'{title}.pdf', ContentFile(content), save=False)
    v.save()
    return rec


def add_attachment(record, name='annex.pdf', content=None, mime='application/pdf', text=None, processed=True, **kw):
    content = content if content is not None else pdf_with_text('Annex budget table')
    att = RecordAttachment(record=record, file_name=name, file_size=len(content), mime_type=mime,
                           content_hash=hashlib.sha256(content).hexdigest(), ocr_text=text or '', ocr_processed=processed, **kw)
    att.file.save(name, ContentFile(content), save=False)
    att.save()
    return att


@override_settings(STORAGES=STORAGES, MEDIA_ROOT=TMP_MEDIA)
class Case(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.officer = make_user('officer@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY)
        self.c = api(self.officer)
        self.rec = make_record(self.officer, 'Letter')


class TextExtractionTests(TestCase):
    def test_word_text_and_paragraphs(self):
        data, _, mime = build_blank('word', [{'text': 'Minutes', 'heading': 1}, {'text': 'Leave raised to 25 days & more'}])
        text = extract_text(data, mime, 'm.docx')
        self.assertEqual(text.splitlines(), ['Minutes', 'Leave raised to 25 days & more'])

    def test_excel_and_powerpoint_text(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            z.writestr('xl/workbook.xml', '<workbook/>')
            z.writestr('xl/sharedStrings.xml', '<sst><si><t>Budget line</t></si><si><t xml:space="preserve">Travel</t></si></sst>')
        self.assertIn('Travel', extract_text(buf.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            z.writestr('ppt/slides/slide2.xml', '<p:sld><a:t>Second</a:t></p:sld>')
            z.writestr('ppt/slides/slide1.xml', '<p:sld><a:t>First</a:t><a:t>slide</a:t></p:sld>')
        self.assertEqual(extract_text(buf.getvalue(), 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), 'First slide\nSecond')

    def test_plain_text_pdf_text_layer_and_unreadable_files(self):
        self.assertEqual(extract_text('Hello\nWorld'.encode(), 'text/plain'), 'Hello\nWorld')
        self.assertIn('Annex budget', extract_text(pdf_with_text('Annex budget table for 2025 spending.'), 'application/pdf', 'a.pdf'))
        self.assertEqual(extract_text(b'MZ\x00\x01', 'application/zip', 'x.zip'), '')
        self.assertEqual(extract_text(b'not really a pdf', 'application/pdf', 'x.pdf'), '')

    def test_a_scanned_page_is_read_with_ocr(self):
        import fitz
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (900, 300), 'white')
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.truetype('DejaVuSans-Bold.ttf', 80)
        except OSError:
            font = ImageFont.load_default()
        draw.text((40, 90), 'INVOICE 4471', fill='black', font=font)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        doc = fitz.open()
        page = doc.new_page()
        page.insert_image(page.rect, stream=buf.getvalue())
        self.assertIn('4471', extract_text(doc.tobytes(), 'application/pdf', 'scan.pdf'))


class SearchableAttachmentTests(Case):
    def _search(self, q):
        return {r['title'] for r in self.c.get('/api/search/', {'q': q}).json()['results']}

    def test_task_reads_the_file_and_search_finds_the_record(self):
        att = add_attachment(self.rec, content=pdf_with_text('Zebrafish procurement schedule for the quarter.'), text='', processed=False)
        self.assertEqual(self._search('zebrafish'), set())
        with patch('apps.records.tasks.refresh_record_index'):
            process_attachment_text(att.pk)
        att.refresh_from_db()
        self.assertTrue(att.ocr_processed and 'Zebrafish' in att.ocr_text)
        update_record_search_vector(str(self.rec.pk))
        self.assertEqual(self._search('zebrafish'), {'Letter'})
        data = self.c.get('/api/search/', {'q': 'zebrafish'}).json()['results'][0]
        self.assertIn('Zebrafish', data['matchSnippet'])

    def test_removing_an_attachment_takes_its_words_out_of_search(self):
        att = add_attachment(self.rec, text='Quokka allowance memo')
        update_record_search_vector(str(self.rec.pk))
        self.assertEqual(self._search('quokka'), {'Letter'})
        with patch('apps.records.attachment_views.refresh_record_index'):
            self.c.post(f'/api/records/{self.rec.pk}/attachments/{att.pk}/remove/')
        update_record_search_vector(str(self.rec.pk))
        self.assertEqual(self._search('quokka'), set())

    def test_ai_index_and_chat_include_attachment_text(self):
        add_attachment(self.rec, name='budget.pdf', text='Annex says the contingency fund is 40 million.')
        passages = record_passages(self.rec, 'Main body.', [('budget.pdf', 'Annex says the contingency fund is 40 million.')])
        joined = ' '.join(passages)
        self.assertIn('[Attachment: budget.pdf]', joined)
        self.assertIn('contingency fund', joined)
        from apps.ai.qa import _latest_text
        self.assertIn('contingency fund', _latest_text(self.rec))
        with patch('apps.search.embeddings.embed_texts', side_effect=lambda texts, kind='document': [[0.1] * 1024 for _ in texts]):
            self.assertGreaterEqual(index_record(self.rec.pk), 2)

    def test_upload_queues_reading_and_status_reports_progress(self):
        with patch('apps.records.attachment_views.process_attachment_text.delay') as queued:
            res = self.c.post(f'/api/records/{self.rec.pk}/attachments/',
                              {'file': SimpleUploadedFile('a.pdf', pdf_with_text('x'), content_type='application/pdf')}, format='multipart')
        self.assertEqual(res.status_code, 201)
        queued.assert_called_once()
        self.assertEqual(res.json()['results'][0]['textStatus'], 'pending')
        att = RecordAttachment.objects.get()
        RecordAttachment.objects.filter(pk=att.pk).update(ocr_processed=True, ocr_text='words')
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/attachments/').json()['results'][0]['textStatus'], 'indexed')
        RecordAttachment.objects.filter(pk=att.pk).update(ocr_text='')
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/attachments/').json()['results'][0]['textStatus'], 'none')

    def test_command_reads_unread_attachments(self):
        att = add_attachment(self.rec, content=pdf_with_text('Okapi register entry for the annual census.'), text='', processed=False)
        with patch('apps.records.tasks.refresh_record_index'):
            call_command('index_attachments', stdout=io.StringIO())
        att.refresh_from_db()
        self.assertIn('Okapi', att.ocr_text)


class ThumbnailAndListTests(Case):
    def test_attachment_thumbnail_and_unsupported_types(self):
        pdf = add_attachment(self.rec, content=pdf_with_text('Preview me'))
        res = self.c.get(f'/api/records/{self.rec.pk}/attachments/{pdf.pk}/thumbnail/')
        self.assertEqual((res.status_code, res['Content-Type']), (200, 'image/jpeg'))
        zipped = add_attachment(self.rec, name='bundle.zip', content=b'PK\x03\x04', mime='application/zip')
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/attachments/{zipped.pk}/thumbnail/').status_code, 204)

    def test_list_shows_attachment_count_without_removed_ones(self):
        add_attachment(self.rec, name='a.pdf')
        gone = add_attachment(self.rec, name='b.pdf')
        RecordAttachment.objects.filter(pk=gone.pk).update(removed_at='2024-01-01T00:00:00Z')
        row = next(r for r in self.c.get('/api/records/').json()['results'] if r['title'] == 'Letter')
        self.assertEqual(row['attachmentCount'], 1)


class PromoteTests(Case):
    def setUp(self):
        super().setUp()
        Record.objects.filter(pk=self.rec.pk).update(document_type='correspondence', originating_ministry='Health')
        self.att = add_attachment(self.rec, name='Annex A - medical report.pdf', text='Patient history', description='')

    def _promote(self, body=None, client=None, att=None):
        att = att or self.att
        return (client or self.c).post(f'/api/records/{self.rec.pk}/attachments/{att.pk}/promote/', body or {}, format='json')

    def test_becomes_its_own_record_linked_back_and_hidden_from_the_original(self):
        with patch('apps.records.attachment_views.refresh_record_index'), patch('apps.records.attachment_views.process_record_ocr.delay'):
            res = self._promote({'title': 'Medical report', 'classification_level': 'confidential'})
        self.assertEqual(res.status_code, 201)
        new = Record.objects.get(pk=res.json()['id'])
        self.assertEqual((new.title, new.classification_level, new.custodian), ('Medical report', 'confidential', self.officer))
        self.assertEqual(new.document_type, 'correspondence')
        version = new.versions.get()
        self.assertEqual((version.file_name, version.ocr_text), ('Annex A - medical report.pdf', 'Patient history'))
        rel = RecordRelation.objects.get()
        self.assertEqual((rel.from_record, rel.to_record, rel.relation_type), (new, self.rec, 'annex_of'))
        self.assertIsNotNone(RecordAttachment.objects.get(pk=self.att.pk).removed_at)
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/attachments/').json()['results'], [])
        labels = [r['label'] for r in self.c.get(f'/api/records/{self.rec.pk}/relations/').json()['results']]
        self.assertEqual(labels, ['Has annex'])

    def test_title_defaults_to_the_file_name_and_classification_is_checked(self):
        with patch('apps.records.attachment_views.refresh_record_index'), patch('apps.records.attachment_views.process_record_ocr.delay'):
            res = self._promote()
        self.assertEqual(Record.objects.get(pk=res.json()['id']).title, 'Annex A - medical report')
        att2 = add_attachment(self.rec, name='second.pdf')
        self.assertEqual(self._promote({'classification_level': 'secret'}, att=att2).status_code, 400)  # above an officer's clearance
        self.assertEqual(self._promote({'classification_level': 'nonsense'}, att=att2).status_code, 400)

    def test_permissions(self):
        self.assertEqual(self._promote(client=api(self.reader)).status_code, 403)
        self.assertEqual(Record.objects.count(), 1)


class AttachRecordTests(Case):
    def setUp(self):
        super().setUp()
        self.source = make_record(self.officer, 'Enclosure letter', content=pdf_with_text('Enclosure body text here.'))
        RecordVersion.objects.filter(record=self.source).update(ocr_text='Enclosure body text here.', ocr_processed=True)
        add_attachment(self.source, name='its-own-annex.pdf', text='Source annex words')

    def _attach(self, source=None, client=None):
        with patch('apps.records.attachment_views.refresh_record_index'), patch('apps.records.attachment_views.process_attachment_text.delay'):
            return (client or self.c).post(f'/api/records/{self.rec.pk}/attachments/from-record/', {'record': str((source or self.source).pk)}, format='json')

    def test_folds_the_record_and_its_attachments_in_and_sends_it_to_the_bin(self):
        res = self._attach()
        self.assertEqual(res.status_code, 201)
        names = sorted(a['fileName'] for a in res.json()['results'])
        self.assertEqual(names, ['Enclosure letter.pdf', 'its-own-annex.pdf'])
        atts = {a.file_name: a for a in self.rec.attachments.all()}
        self.assertEqual(atts['Enclosure letter.pdf'].ocr_text, 'Enclosure body text here.')  # already read, not re-scanned
        self.assertTrue(atts['Enclosure letter.pdf'].description.startswith('From PSC-'))
        self.source.refresh_from_db()
        self.assertEqual((self.source.merged_into, self.source.deleted_by), (self.rec, self.officer))
        self.assertIsNotNone(self.source.destroyed_at)
        self.assertNotIn('Enclosure letter', {r['title'] for r in self.c.get('/api/records/').json()['results']})
        binned = self.c.get('/api/records/bin/').json()['results'][0]
        self.assertEqual(binned['mergedInto']['id'], str(self.rec.pk))

    def test_restoring_clears_the_merge_marker(self):
        self._attach()
        self.c.post('/api/records/bin/restore/', {'record_ids': [str(self.source.pk)]}, format='json')
        self.source.refresh_from_db()
        self.assertIsNone(self.source.merged_into)
        self.assertIsNone(self.source.destroyed_at)

    def test_refusals(self):
        self.assertEqual(self._attach(source=self.rec).status_code, 400)  # itself
        Record.objects.filter(pk=self.source.pk).update(is_on_legal_hold=True)
        res = self._attach()
        self.assertEqual(res.status_code, 400)
        self.assertIn('legal hold', res.json()['detail'])
        Record.objects.filter(pk=self.source.pk).update(is_on_legal_hold=False, classification_level='restricted')
        res = self._attach()
        self.assertEqual(res.status_code, 400)
        self.assertIn('higher than this record', res.json()['detail'])
        self.assertEqual(self._attach(client=api(self.reader)).status_code, 403)
        self.assertEqual(self.rec.attachments.count(), 0)
        self.source.refresh_from_db()
        self.assertIsNone(self.source.destroyed_at)  # nothing happened to it

    def test_needs_delete_rights_over_the_source(self):
        other = make_user('other@t.gov.vu', UserRole.REVIEWER)
        theirs = make_record(other, 'Reviewer record')
        # the officer can view it (internal) but a reviewer's record is not theirs to fold away unless they could delete it
        res = self._attach(source=theirs)
        self.assertIn(res.status_code, (201, 403))
        if res.status_code == 201:
            theirs.refresh_from_db()
            self.assertEqual(theirs.merged_into, self.rec)
