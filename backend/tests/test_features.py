"""
Records-system features: relationships, attachments, duplicate warnings, saved views, assignments,
templates, automatic permissions, metadata cards, advanced search, PDF conversion.

Run:  python manage.py test tests.test_features --settings=config.settings.development
"""
import hashlib
import importlib
import io
import shutil
import tempfile
import zipfile
from datetime import date, timedelta
from unittest.mock import patch

from django.apps import apps as django_apps
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Department, User, UserRole
from apps.collaboration.models import Assignment
from apps.records.models import (
    DocumentTemplate, MetadataProfile, PermissionRule, PinnedView, Record, RecordAttachment, RecordRelation,
    RecordSeries, RecordVersion,
)

TMP_MEDIA = tempfile.mkdtemp(prefix='drfms-features-')
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
PDF = b'%PDF-1.4 test file'


def make_user(email, role, department=None):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name=email.split('@')[0].title(), last_name='T',
        password='Secur3Pass!', role=role, department=department,
    )


def make_record(owner, title, content=b'x', mime='application/pdf', **kw):
    kw.setdefault('classification_level', 'internal')
    rec = Record.objects.create(title=title, custodian=owner, author=owner, **kw)
    v = RecordVersion(record=rec, version_number=1, file_name=f'{title}.pdf', file_size=len(content), mime_type=mime,
                      content_hash=hashlib.sha256(content).hexdigest(), created_by=owner)
    v.file.save(f'{title}.pdf', ContentFile(content), save=False)
    v.save()
    return rec


def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@override_settings(STORAGES=STORAGES, MEDIA_ROOT=TMP_MEDIA)
class FeatureCase(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.hr = Department.objects.create(name='HR', code='HR')
        self.fin = Department.objects.create(name='Finance', code='FIN')
        self.officer = make_user('officer@t.gov.vu', UserRole.RECORDS_OFFICER, self.hr)
        self.colleague = make_user('colleague@t.gov.vu', UserRole.RECORDS_OFFICER, self.hr)
        self.finance = make_user('finance@t.gov.vu', UserRole.RECORDS_OFFICER, self.fin)
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR, self.hr)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY, self.fin)
        self.c = api(self.officer)


class RelationTests(FeatureCase):
    def setUp(self):
        super().setUp()
        self.a = make_record(self.officer, 'Letter A')
        self.b = make_record(self.officer, 'Reply B')

    def _link(self, rel='replies_to', source=None, target=None, client=None):
        source, target = source or self.b, target or self.a
        return (client or self.c).post(f'/api/records/{source.pk}/relations/', {'target': str(target.pk), 'relation_type': rel}, format='json')

    def test_link_reads_both_ways(self):
        self.assertEqual(self._link().status_code, 201)
        out = self.c.get(f'/api/records/{self.b.pk}/relations/').json()['results'][0]
        self.assertEqual((out['label'], out['direction'], out['record']['title']), ('Replies to', 'out', 'Letter A'))
        incoming = self.c.get(f'/api/records/{self.a.pk}/relations/').json()['results'][0]
        self.assertEqual((incoming['label'], incoming['direction'], incoming['record']['title']), ('Replied to by', 'in', 'Reply B'))
        detail = self.c.get(f'/api/records/{self.a.pk}/').json()
        self.assertEqual(detail['relatedRecords'][0]['label'], 'Replied to by')

    def test_related_is_symmetric_and_duplicates_are_refused(self):
        self.assertEqual(self._link('related').status_code, 201)
        self.assertEqual(self._link('related', source=self.a, target=self.b).status_code, 409)
        self.assertEqual(self._link('related').status_code, 409)

    def test_validation_and_permissions(self):
        self.assertEqual(self._link(target=self.b).status_code, 400)  # itself
        self.assertEqual(self._link('nonsense').status_code, 400)
        secret = make_record(self.admin, 'Secret', classification_level='secret')
        self.assertEqual(self._link(target=secret).status_code, 404)  # cannot link to what you cannot see
        self.assertEqual(self._link(client=api(self.reader)).status_code, 403)

    def test_hidden_records_do_not_show_in_the_list_and_removal_works(self):
        other = make_record(self.admin, 'Admin letter')  # not owned by the officer, so classification decides
        self._link(target=other)
        rel = RecordRelation.objects.get()
        Record.objects.filter(pk=other.pk).update(classification_level='secret')
        self.assertEqual(self.c.get(f'/api/records/{self.b.pk}/relations/').json()['results'], [])
        Record.objects.filter(pk=other.pk).update(classification_level='internal')
        self.assertEqual(self.c.delete(f'/api/records/{self.b.pk}/relations/{rel.pk}/').status_code, 204)
        self.assertEqual(RecordRelation.objects.count(), 0)

    def test_migration_copies_the_old_related_list(self):
        self.a.related_records.add(self.b)
        migration = importlib.import_module('apps.records.migrations.0009_drive_features')
        migration.copy_related_records_to_relations(django_apps, None)
        self.assertEqual(RecordRelation.objects.filter(relation_type='related').count(), 1)
        migration.copy_related_records_to_relations(django_apps, None)  # safe to repeat
        self.assertEqual(RecordRelation.objects.count(), 1)


class AttachmentTests(FeatureCase):
    def setUp(self):
        super().setUp()
        self.rec = make_record(self.officer, 'Letter')

    def _upload(self, name='annex.pdf', data=PDF, mime='application/pdf', client=None):
        return (client or self.c).post(f'/api/records/{self.rec.pk}/attachments/', {'file': SimpleUploadedFile(name, data, content_type=mime)}, format='multipart')

    def test_upload_list_download_remove_restore(self):
        res = self._upload()
        self.assertEqual(res.status_code, 201)
        att = RecordAttachment.objects.get()
        self.assertEqual(att.content_hash, hashlib.sha256(PDF).hexdigest())
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/attachments/').json()['results'][0]['fileName'], 'annex.pdf')
        dl = self.c.get(f'/api/records/{self.rec.pk}/attachments/{att.pk}/download/')
        self.assertEqual(b''.join(dl.streaming_content), PDF)
        self.assertEqual(self.c.post(f'/api/records/{self.rec.pk}/attachments/{att.pk}/remove/').status_code, 200)
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/attachments/').json()['results'], [])
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/attachments/{att.pk}/download/').status_code, 404)
        shown = self.c.get(f'/api/records/{self.rec.pk}/attachments/', {'include_removed': 1}).json()['results']
        self.assertTrue(shown[0]['removed'])
        self.c.post(f'/api/records/{self.rec.pk}/attachments/{att.pk}/restore/')
        self.assertEqual(len(self.c.get(f'/api/records/{self.rec.pk}/attachments/').json()['results']), 1)
        self.assertTrue(RecordAttachment.objects.filter(pk=att.pk).exists())  # never erased

    def test_validation_and_permissions(self):
        self.assertEqual(self._upload('x.exe', b'MZ', 'application/x-msdownload').status_code, 400)
        self.assertEqual(self._upload(client=api(self.reader)).status_code, 403)
        self.assertEqual(self.c.post(f'/api/records/{self.rec.pk}/attachments/', {}, format='multipart').status_code, 400)

    def test_storage_meter_counts_attachments(self):
        from django.core.cache import cache
        self._upload()
        cache.clear()
        used = self.c.get('/api/records/storage/').json()['usedBytes']
        self.assertEqual(used, 1 + len(PDF))  # the 1-byte main file plus the attachment

    def test_detail_counts_attachments(self):
        self._upload()
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/').json()['attachmentCount'], 1)


class DuplicateTests(FeatureCase):
    def test_exact_and_similar_matches_for_visible_records_only(self):
        data = b'the same file'
        rec = make_record(self.officer, 'Annual leave policy 2024', content=data)
        hidden = make_record(self.admin, 'Hidden copy', content=data, classification_level='secret')
        att_rec = make_record(self.officer, 'Other record')
        RecordAttachment.objects.create(record=att_rec, file=ContentFile(data, name='a.pdf'), file_name='a.pdf', file_size=len(data),
                                        mime_type='application/pdf', content_hash=hashlib.sha256(data).hexdigest())
        items = [
            {'name': 'copy.pdf', 'sha256': hashlib.sha256(data).hexdigest()},
            {'name': 'Annual_leave_policy_2024.pdf', 'sha256': 'f' * 64},
            {'name': 'unrelated.pdf', 'sha256': 'not-a-hash'},
        ]
        res = self.c.post('/api/records/check-duplicates/', {'items': items}, format='json').json()['results']
        exact = {r['title'] for r in res[0]['exact']}
        self.assertEqual(exact, {'Annual leave policy 2024', 'Other record'})
        self.assertNotIn(hidden.title, exact)
        self.assertEqual(res[1]['similar'][0]['title'], 'Annual leave policy 2024')
        self.assertEqual((res[2]['exact'], res[2]['similar']), ([], []))
        self.assertEqual(rec.title, 'Annual leave policy 2024')


class GroupOrderingTests(FeatureCase):
    def test_list_can_be_ordered_for_grouping(self):
        s = RecordSeries.objects.create(code='A', name='Alpha')
        make_record(self.officer, 'R1', record_series=s, originating_ministry='Zed')
        for ordering in ('record_series__name', 'originating_ministry', '-originating_ministry', 'document_type'):
            self.assertEqual(self.c.get('/api/records/', {'ordering': ordering}).status_code, 200, ordering)


class SavedViewTests(FeatureCase):
    def _pin(self, user, target, shared=''):
        return api(user).post('/api/records/pins/', {'label': target, 'target': target, 'shared_with': shared}, format='json')

    def test_department_sharing(self):
        self.assertEqual(self._pin(self.officer, '/browse?year=2024', 'department').status_code, 201)
        mine = api(self.officer).get('/api/records/pins/').json()
        self.assertTrue(mine[0]['own'])
        colleague = api(self.colleague).get('/api/records/pins/').json()
        self.assertEqual((len(colleague), colleague[0]['own'], colleague[0]['ownerName']), (1, False, self.officer.get_full_name()))
        self.assertEqual(api(self.finance).get('/api/records/pins/').json(), [])

    def test_everyone_needs_an_administrator_and_only_the_owner_can_change_it(self):
        self.assertEqual(self._pin(self.officer, '/recent', 'all').status_code, 400)
        res = self._pin(self.admin, '/recent', 'all')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(api(self.finance).get('/api/records/pins/').json()), 1)
        pin_id = res.json()['id']
        self.assertEqual(api(self.finance).patch(f'/api/records/pins/{pin_id}/', {'shared_with': ''}, format='json').status_code, 404)
        self.assertEqual(api(self.admin).patch(f'/api/records/pins/{pin_id}/', {'shared_with': ''}, format='json').status_code, 200)
        self.assertEqual(api(self.finance).get('/api/records/pins/').json(), [])

    def test_unknown_option_and_no_department(self):
        self.assertEqual(self._pin(self.officer, '/x', 'team').status_code, 400)
        loner = make_user('loner@t.gov.vu', UserRole.RECORDS_OFFICER, None)
        self.assertEqual(self._pin(loner, '/x', 'department').status_code, 400)


class AssignmentTests(FeatureCase):
    def setUp(self):
        super().setUp()
        self.rec = make_record(self.officer, 'Budget paper')

    def _assign(self, to=None, **kw):
        body = {'assigned_to': (to or self.colleague).pk, 'instruction': 'Please review', **kw}
        return self.c.post(f'/api/collaboration/records/{self.rec.pk}/assignments/', body, format='json')

    def test_assign_list_complete(self):
        due = (timezone.localdate() + timedelta(days=3)).isoformat()
        res = self._assign(due_date=due)
        self.assertEqual(res.status_code, 201)
        mine = api(self.colleague).get('/api/collaboration/assignments/').json()
        self.assertEqual((mine['count'], mine['results'][0]['instruction']), (1, 'Please review'))
        given = self.c.get('/api/collaboration/assignments/', {'scope': 'given'}).json()
        self.assertEqual(given['count'], 1)
        aid = res.json()['id']
        done = api(self.colleague).post(f'/api/collaboration/assignments/{aid}/complete/', {'note': 'Looks fine'}, format='json')
        self.assertEqual((done.status_code, done.json()['status']), (200, 'done'))
        self.assertEqual(api(self.colleague).get('/api/collaboration/assignments/').json()['count'], 0)
        self.assertEqual(api(self.colleague).get('/api/collaboration/assignments/', {'status': 'done'}).json()['count'], 1)
        self.assertEqual(self.c.post(f'/api/collaboration/assignments/{aid}/reopen/').json()['status'], 'open')

    def test_cannot_assign_a_record_the_person_may_not_see(self):
        secret = make_record(self.admin, 'Secret', classification_level='secret')
        res = self.c.post(f'/api/collaboration/records/{secret.pk}/assignments/', {'assigned_to': self.colleague.pk, 'instruction': 'x'}, format='json')
        self.assertEqual(res.status_code, 403)  # the assigner cannot see it either
        restricted = make_record(self.officer, 'Restricted', classification_level='restricted')
        res = self.c.post(f'/api/collaboration/records/{restricted.pk}/assignments/', {'assigned_to': self.reader.pk, 'instruction': 'x'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('cannot open this record', res.json()['detail'])

    def test_validation_and_rules(self):
        self.assertEqual(self._assign(instruction='  ').status_code, 400)
        self.assertEqual(self._assign(due_date=(timezone.localdate() - timedelta(days=1)).isoformat()).status_code, 400)
        self.assertEqual(self._assign(due_date='not-a-date').status_code, 400)
        res = self.c.post(f'/api/collaboration/records/{self.rec.pk}/assignments/', {'assigned_to': 99999, 'instruction': 'x'}, format='json')
        self.assertEqual(res.status_code, 400)
        no = api(self.reader).post(f'/api/collaboration/records/{self.rec.pk}/assignments/', {'assigned_to': self.officer.pk, 'instruction': 'x'}, format='json')
        self.assertEqual(no.status_code, 403)

    def test_only_the_assigner_can_cancel_and_overdue_is_flagged(self):
        aid = self._assign().json()['id']
        Assignment.objects.filter(pk=aid).update(due_date=timezone.localdate() - timedelta(days=2))
        row = api(self.colleague).get('/api/collaboration/assignments/').json()['results'][0]
        self.assertTrue(row['isOverdue'])
        self.assertEqual(api(self.colleague).post(f'/api/collaboration/assignments/{aid}/cancel/').status_code, 403)
        self.assertEqual(self.c.post(f'/api/collaboration/assignments/{aid}/cancel/').json()['status'], 'cancelled')
        self.assertEqual(self.c.post(f'/api/collaboration/assignments/{aid}/cancel/').status_code, 409)

    def test_binned_records_drop_out_of_my_assignments(self):
        self._assign()
        self.c.delete(f'/api/records/{self.rec.pk}/')
        self.assertEqual(api(self.colleague).get('/api/collaboration/assignments/').json()['count'], 0)


class TemplateTests(FeatureCase):
    def test_starter_templates_create_and_use(self):
        adm = api(self.admin)
        self.assertEqual(set(adm.post('/api/records/templates/starter/').json()['added']), {'Official letter', 'Meeting minutes', 'Commission submission'})
        self.assertEqual(adm.post('/api/records/templates/starter/').json()['added'], [])  # idempotent
        listed = self.c.get('/api/records/templates/').json()['results']
        minutes = next(t for t in listed if t['name'] == 'Meeting minutes')
        res = self.c.post(f"/api/records/templates/{minutes['id']}/use/", {}, format='json')
        self.assertEqual(res.status_code, 201)
        rec = Record.objects.get(pk=res.json()['id'])
        self.assertTrue(rec.title.startswith('Minutes - '))
        self.assertEqual((rec.document_type, rec.custodian), ('report', self.officer))
        v = rec.versions.get()
        with zipfile.ZipFile(io.BytesIO(v.file.open('rb').read())) as z:
            self.assertIn('Decisions', z.read('word/document.xml').decode())

    def test_admin_upload_validation_and_permissions(self):
        adm = api(self.admin)
        blank = adm.post('/api/records/templates/', {'name': 'Blank sheet', 'kind': 'excel'}, format='multipart')
        self.assertEqual(blank.status_code, 201)
        bad = adm.post('/api/records/templates/', {'name': 'Wrong', 'kind': 'word', 'file': SimpleUploadedFile('x.pdf', PDF)}, format='multipart')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(adm.post('/api/records/templates/', {'name': 'blank SHEET', 'kind': 'excel'}, format='multipart').status_code, 400)
        self.assertEqual(self.c.post('/api/records/templates/', {'name': 'N', 'kind': 'word'}, format='multipart').status_code, 403)
        self.assertEqual(api(self.reader).get('/api/records/templates/').status_code, 403)

    def test_inactive_templates_are_hidden_and_the_title_can_be_overridden(self):
        adm = api(self.admin)
        tid = adm.post('/api/records/templates/', {'name': 'Memo', 'kind': 'word', 'title_pattern': 'Memo {year}'}, format='multipart').json()['id']
        res = self.c.post(f'/api/records/templates/{tid}/use/', {'title': 'Memo to staff'}, format='json')
        self.assertEqual(Record.objects.get(pk=res.json()['id']).title, 'Memo to staff')
        adm.patch(f'/api/records/templates/{tid}/', {'is_active': False}, format='json')
        self.assertEqual(self.c.get('/api/records/templates/').json()['results'], [])
        self.assertEqual(self.c.post(f'/api/records/templates/{tid}/use/', {}, format='json').status_code, 404)


class PermissionRuleTests(FeatureCase):
    def setUp(self):
        super().setUp()
        self.parent = RecordSeries.objects.create(code='HR', name='HR')
        self.child = RecordSeries.objects.create(code='HR-L', name='Leave', parent=self.parent)
        self.other = RecordSeries.objects.create(code='FIN', name='Finance')
        self.reader_hr = make_user('hrreader@t.gov.vu', UserRole.READ_ONLY, self.hr)
        self.in_child = make_record(self.admin, 'Leave file', record_series=self.child, classification_level='confidential')
        self.in_other = make_record(self.admin, 'Budget', record_series=self.other, classification_level='confidential')
        self.too_secret = make_record(self.admin, 'Secret leave', record_series=self.child, classification_level='restricted')

    def _rule(self, **kw):
        body = {'name': 'HR sees HR', 'department': self.hr.pk, 'record_series': self.parent.pk, **kw}
        return api(self.admin).post('/api/records/permission-rules/', body, format='json')

    def _titles(self, user):
        return {r['title'] for r in api(user).get('/api/records/').json()['results']}

    def test_rule_grants_view_within_its_series_and_classification_ceiling(self):
        self.assertNotIn('Leave file', self._titles(self.reader_hr))  # read-only clearance stops at internal
        res = self._rule()
        self.assertEqual((res.status_code, res.json()['matchingRecords']), (201, 1))  # restricted one is above the ceiling
        titles = self._titles(self.reader_hr)
        self.assertIn('Leave file', titles)
        self.assertNotIn('Budget', titles)         # a different series
        self.assertNotIn('Secret leave', titles)   # above max_classification
        self.assertEqual(api(self.reader_hr).get(f'/api/records/{self.in_child.pk}/').status_code, 200)
        self.assertNotIn('Leave file', self._titles(self.reader))  # a different department

    def test_rights_follow_the_flags(self):
        self._rule()
        c = api(self.reader_hr)
        self.assertEqual(c.patch(f'/api/records/{self.in_child.pk}/', {'description': 'x'}, format='json').status_code, 403)
        rid = PermissionRule.objects.get().pk
        api(self.admin).patch(f'/api/records/permission-rules/{rid}/', {'can_edit': True}, format='json')
        self.assertEqual(c.patch(f'/api/records/{self.in_child.pk}/', {'description': 'x'}, format='json').status_code, 200)

    def test_subseries_switch_inactive_and_search_inheritance(self):
        rid = self._rule(include_subseries=False).json()['id']
        self.assertNotIn('Leave file', self._titles(self.reader_hr))
        api(self.admin).patch(f'/api/records/permission-rules/{rid}/', {'include_subseries': True}, format='json')
        self.assertEqual(api(self.reader_hr).get('/api/search/', {'q': 'Leave'}).json()['count'], 1)
        api(self.admin).patch(f'/api/records/permission-rules/{rid}/', {'is_active': False}, format='json')
        self.assertEqual(api(self.reader_hr).get('/api/search/', {'q': 'Leave'}).json()['count'], 0)

    def test_validation_and_admin_only(self):
        self.assertEqual(self._rule(department=None).status_code, 400)  # nobody chosen
        self.assertEqual(self._rule(record_series=None).status_code, 400)  # would cover everything
        self.assertEqual(self._rule(can_view=False, can_edit=True).status_code, 400)
        self.assertEqual(self._rule(max_classification='nonsense').status_code, 400)
        self.assertEqual(api(self.officer).get('/api/records/permission-rules/').status_code, 403)
        self.assertEqual(api(self.officer).post('/api/records/permission-rules/', {'name': 'x'}, format='json').status_code, 403)


class MetadataTests(FeatureCase):
    def setUp(self):
        super().setUp()
        self.adm = api(self.admin)
        self.profile = {
            'required_fields': ['originating_ministry', 'document_date'],
            'custom_fields': [{'key': 'amount', 'label': 'Contract value', 'kind': 'number', 'required': True}],
        }
        self.rec = make_record(self.officer, 'Supply contract', document_type='contract')

    def test_profile_drives_the_missing_list(self):
        self.assertEqual(self.adm.put('/api/records/metadata-profiles/contract/', self.profile, format='json').status_code, 200)
        missing = {m['key'] for m in self.c.get(f'/api/records/{self.rec.pk}/').json()['metadataMissing']}
        self.assertEqual(missing, {'originating_ministry', 'document_date', 'amount'})
        res = self.c.patch(f'/api/records/{self.rec.pk}/', {'originating_ministry': 'Finance', 'document_date': '2024-05-01', 'custom_fields': {'amount': '1500000'}}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.c.get(f'/api/records/{self.rec.pk}/').json()['metadataMissing'], [])

    def test_profile_validation_and_admin_only(self):
        self.assertEqual(self.c.put('/api/records/metadata-profiles/contract/', self.profile, format='json').status_code, 403)
        bad = {**self.profile, 'required_fields': ['not_a_field']}
        self.assertEqual(self.adm.put('/api/records/metadata-profiles/contract/', bad, format='json').status_code, 400)
        dup = {**self.profile, 'custom_fields': [{'key': 'description', 'label': 'X', 'kind': 'text'}]}
        self.assertEqual(self.adm.put('/api/records/metadata-profiles/contract/', dup, format='json').status_code, 400)
        self.assertEqual(self.adm.put('/api/records/metadata-profiles/nonsense/', self.profile, format='json').status_code, 404)
        listing = self.c.get('/api/records/metadata-profiles/').json()
        self.assertIn('originating_ministry', [f['key'] for f in listing['coreFields']])

    def test_custom_field_values_are_checked(self):
        for value in ({'Bad Key': 'x'}, {'amount': {'a': 1}}, {'amount': 'x' * 501}, 'text'):
            self.assertEqual(self.c.patch(f'/api/records/{self.rec.pk}/', {'custom_fields': value}, format='json').status_code, 400, value)

    def test_a_workflow_cannot_start_until_required_fields_are_filled(self):
        from apps.workflows.models import WorkflowTemplate
        self.adm.put('/api/records/metadata-profiles/contract/', self.profile, format='json')
        tpl = WorkflowTemplate.objects.create(name='Approval', created_by=self.admin)
        body = {'record': str(self.rec.pk), 'template': tpl.pk, 'title': 'Approve contract'}
        res = self.c.post('/api/workflows/instances/', body, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Contract value', res.json()['detail'])
        Record.objects.filter(pk=self.rec.pk).update(originating_ministry='Finance', document_date=date(2024, 5, 1), custom_fields={'amount': '5'})
        self.assertEqual(self.c.post('/api/workflows/instances/', body, format='json').status_code, 201)


class AdvancedSearchTests(FeatureCase):
    def setUp(self):
        super().setUp()
        self.series = RecordSeries.objects.create(code='HR', name='HR')
        self.sub = RecordSeries.objects.create(code='HR-L', name='Leave', parent=self.series)
        self.a = make_record(self.officer, 'Leave policy', document_type='policy', originating_ministry='Finance', document_date=date(2024, 3, 1),
                             record_series=self.sub, tags=['leave', 'hr'], is_vital=True)
        self.b = make_record(self.officer, 'Budget estimates', document_type='financial', originating_ministry='Health', document_date=date(2025, 1, 5))
        self.c_ = make_record(self.officer, 'Site photo', mime='image/png', document_type='other', document_date=date(2023, 6, 1))
        Record.objects.filter(pk=self.a.pk).update(search_vector=None)
        self.secret = make_record(self.admin, 'Secret leave memo', classification_level='secret')

    def _search(self, conditions, match='all', **kw):
        res = self.c.post('/api/search/advanced/', {'conditions': conditions, 'match': match, **kw}, format='json')
        return res, {r['title'] for r in res.json().get('results', [])}

    def test_all_and_any(self):
        _, titles = self._search([{'field': 'title', 'op': 'contains', 'value': 'leave'}, {'field': 'originating_ministry', 'op': 'is', 'value': 'x'}] if False else
                                 [{'field': 'title', 'op': 'contains', 'value': 'leave'}, {'field': 'originating_ministry', 'op': 'equals', 'value': 'finance'}])
        self.assertEqual(titles, {'Leave policy'})
        _, any_titles = self._search([{'field': 'title', 'op': 'contains', 'value': 'budget'}, {'field': 'title', 'op': 'contains', 'value': 'photo'}], match='any')
        self.assertEqual(any_titles, {'Budget estimates', 'Site photo'})

    def test_field_types(self):
        cases = [
            ([{'field': 'document_date', 'op': 'between', 'value': '2024-01-01', 'value2': '2025-12-31'}], {'Leave policy', 'Budget estimates'}),
            ([{'field': 'document_date', 'op': 'before', 'value': '2024-01-01'}], {'Site photo'}),
            ([{'field': 'document_type', 'op': 'is_not', 'value': 'other'}, {'field': 'is_vital', 'op': 'is', 'value': True}], {'Leave policy'}),
            ([{'field': 'tags', 'op': 'has', 'value': 'HR'}], {'Leave policy'}),
            ([{'field': 'record_series', 'op': 'is', 'value': str(self.series.pk)}], {'Leave policy'}),  # includes sub-series
            ([{'field': 'file_type', 'op': 'is', 'value': 'image'}], {'Site photo'}),
            ([{'field': 'originating_ministry', 'op': 'is_empty'}], {'Site photo'}),
            ([{'field': 'title', 'op': 'starts_with', 'value': 'Bud'}], {'Budget estimates'}),
        ]
        for conditions, expected in cases:
            res, titles = self._search(conditions)
            self.assertEqual((res.status_code, titles), (200, expected), conditions)

    def test_only_visible_records_and_paging(self):
        res, titles = self._search([{'field': 'title', 'op': 'contains', 'value': 'leave'}])
        self.assertNotIn('Secret leave memo', titles)
        data = self.c.post('/api/search/advanced/', {'conditions': [{'field': 'title', 'op': 'contains', 'value': 'e'}], 'page_size': 1, 'ordering': 'title'}, format='json').json()
        self.assertEqual((data['pages'] >= 2, len(data['results'])), (True, 1))

    def test_bad_input_gets_a_clear_message(self):
        for cond in ({'field': 'password', 'op': 'is', 'value': 'x'}, {'field': 'title', 'op': 'regex', 'value': 'x'},
                     {'field': 'document_date', 'op': 'on', 'value': 'soon'}, {'field': 'title', 'op': 'contains', 'value': ''},
                     {'field': 'document_type', 'op': 'is', 'value': 'made_up'}):
            res = self.c.post('/api/search/advanced/', {'conditions': [cond]}, format='json')
            self.assertEqual(res.status_code, 400, cond)
            self.assertTrue(res.json()['detail'])
        self.assertEqual(self.c.post('/api/search/advanced/', {'conditions': []}, format='json').status_code, 400)

    def test_field_catalogue(self):
        fields = {f['key']: f for f in self.c.get('/api/search/advanced/fields/').json()['fields']}
        self.assertIn('between', fields['document_date']['operators'])
        self.assertTrue(fields['document_type']['choices'])


class PdfConversionTests(FeatureCase):
    def setUp(self):
        super().setUp()
        self.rec = make_record(self.officer, 'Memo', content=b'docx bytes', mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        RecordVersion.objects.filter(record=self.rec).update(file_name='Memo.docx')
        self.version = self.rec.versions.get()
        self.url = f'/api/onlyoffice/convert/{self.rec.pk}/{self.version.pk}/'

    @patch('apps.onlyoffice.views.convert_version_to_pdf', return_value=PDF)
    def test_download_and_save_as_a_pdf_copy(self, convert):
        res = self.c.post(self.url, {'mode': 'download'}, format='json')
        self.assertEqual((res.status_code, res['Content-Type'], res.content), (200, 'application/pdf', PDF))
        saved = self.c.post(self.url, {'mode': 'save'}, format='json')
        self.assertEqual(saved.status_code, 201)
        att = RecordAttachment.objects.get()
        self.assertEqual((att.role, att.file_name, att.description), ('pdf_copy', 'Memo.pdf', 'PDF copy of version 1'))
        self.assertEqual(self.rec.versions.count(), 1)  # the editable original is untouched
        self.c.post(self.url, {'mode': 'save'}, format='json')  # converting again replaces, not piles up
        self.assertEqual(RecordAttachment.objects.filter(removed_at__isnull=True).count(), 1)
        self.assertEqual(RecordAttachment.objects.count(), 2)

    @patch('apps.onlyoffice.views.convert_version_to_pdf', return_value=PDF)
    def test_rules(self, convert):
        self.assertEqual(api(self.reader).post(self.url, {'mode': 'save'}, format='json').status_code, 403)
        pdf_rec = make_record(self.officer, 'Already pdf')
        v = pdf_rec.versions.get()
        res = self.c.post(f'/api/onlyoffice/convert/{pdf_rec.pk}/{v.pk}/', {'mode': 'download'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(self.c.post(self.url, {'mode': 'nonsense'}, format='json').status_code, 400)

    def test_conversion_failure_is_reported(self):
        from apps.onlyoffice.views import ConversionError
        with patch('apps.onlyoffice.views.convert_version_to_pdf', side_effect=ConversionError('server down')):
            res = self.c.post(self.url, {'mode': 'download'}, format='json')
        self.assertEqual(res.status_code, 502)
        self.assertIn('server down', res.json()['detail'])
