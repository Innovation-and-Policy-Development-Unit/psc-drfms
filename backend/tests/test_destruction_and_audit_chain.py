"""
Destruction under certificate (separation of duties, execution, erasure) and the append-only audit chain.

Run:  python manage.py test tests.test_destruction_and_audit_chain --settings=config.settings.development
"""
import io
import shutil
import tempfile
from datetime import date

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.audit.models import AppendOnlyError, AuditAction, AuditLog
from apps.compliance.destruction import execute_destruction
from apps.compliance.models import DestructionCertificate, DispositionReview, LegalHold
from apps.records.models import Record, RecordAttachment, RecordVersion
from apps.search.models import RecordChunk
from apps.sharing.models import SharedLink


def make_user(email, role=UserRole.RECORDS_OFFICER):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name='Test', last_name=email.split('@')[0].title(),
        password='Secur3Pass!', role=role,
    )


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def make_record(user, **kwargs):
    defaults = dict(title='Old file', document_type='policy', classification_level='internal',
                    author=user, custodian=user, description='Sensitive description', tags=['x'])
    defaults.update(kwargs)
    record = Record(**defaults)
    record.save()
    return record


def approve_for_destruction(record, user):
    return DispositionReview.objects.create(
        record=record, retention_date=date(2020, 1, 1), proposed_action='destroy',
        status='approved', decided_by=user, decided_at=timezone.now(),
    )


# ---------------------------------------------------------------------------
# Audit log: append-only and hash-chained
# ---------------------------------------------------------------------------

class AuditChainTests(TestCase):
    def setUp(self):
        self.user = make_user('auditor@psc.gov.vu')
        self.record = make_record(self.user)

    def _write(self, n=3):
        return [
            AuditLog.objects.create(user=self.user, action=AuditAction.VIEW, record=self.record, extra={'n': i})
            for i in range(n)
        ]

    def test_entries_form_a_chain(self):
        a, b, c = self._write()
        self.assertEqual(b.seq, a.seq + 1)
        self.assertEqual(b.prev_hash, a.hash)
        self.assertEqual(c.prev_hash, b.hash)
        self.assertEqual(len(a.hash), 64)

    def test_entry_keeps_who_and_what_as_text(self):
        entry = self._write(1)[0]
        self.assertEqual(entry.user_email, 'auditor@psc.gov.vu')
        self.assertEqual(entry.user_name, 'Test Auditor')
        self.assertEqual(entry.record_reference, self.record.reference_number)

    def test_verify_command_passes_on_an_intact_chain(self):
        self._write()
        out = io.StringIO()
        call_command('verify_audit_chain', stdout=out)
        self.assertIn('intact', out.getvalue())

    def test_python_level_edit_and_delete_are_refused(self):
        entry = self._write(1)[0]
        entry.action = AuditAction.DELETE
        with self.assertRaises(AppendOnlyError):
            entry.save()
        with self.assertRaises(AppendOnlyError):
            entry.delete()

    def test_database_refuses_update_and_delete(self):
        entry = self._write(1)[0]
        with self.assertRaises(DatabaseError), transaction.atomic():
            AuditLog.objects.filter(pk=entry.pk).update(action=AuditAction.DELETE)
        with self.assertRaises(DatabaseError), transaction.atomic():
            AuditLog.objects.filter(pk=entry.pk).delete()
        with self.assertRaises(DatabaseError), transaction.atomic():
            AuditLog.objects.filter(pk=entry.pk).update(user_email='someone.else@psc.gov.vu')
        self.assertEqual(AuditLog.objects.get(pk=entry.pk).action, AuditAction.VIEW)

    def test_tampering_with_the_database_is_detected(self):
        a, b, c = self._write()
        with connection.cursor() as cur:  # what a person with database access would have to do first
            cur.execute('SET LOCAL session_replication_role = replica')
            cur.execute("UPDATE audit_auditlog SET extra = '{\"n\": 99}' WHERE id = %s", [str(b.id)])
        with self.assertRaisesMessage(CommandError, f'Entry {b.seq}'):
            call_command('verify_audit_chain', stdout=io.StringIO())

    def test_a_removed_entry_is_detected(self):
        a, b, c = self._write()
        with connection.cursor() as cur:
            cur.execute('SET LOCAL session_replication_role = replica')
            cur.execute('DELETE FROM audit_auditlog WHERE id = %s', [str(b.id)])
        with self.assertRaisesMessage(CommandError, 'missing'):
            call_command('verify_audit_chain', stdout=io.StringIO())

    def test_entries_survive_the_user_being_deleted(self):
        entry = self._write(1)[0]
        self.user.delete()
        entry = AuditLog.objects.get(pk=entry.pk)
        self.assertIsNone(entry.user_id)
        self.assertEqual(entry.user_email, 'auditor@psc.gov.vu')
        call_command('verify_audit_chain', stdout=io.StringIO())

    def test_entries_keep_the_record_reference_after_the_record_is_deleted(self):
        entry = self._write(1)[0]
        reference = self.record.reference_number
        Record.objects.filter(pk=self.record.pk).delete()
        entry = AuditLog.objects.get(pk=entry.pk)
        self.assertIsNone(entry.record_id)
        self.assertEqual(entry.record_reference, reference)
        call_command('verify_audit_chain', stdout=io.StringIO())


# ---------------------------------------------------------------------------
# Shared-link access reaches the audit trail
# ---------------------------------------------------------------------------

class SharedLinkAuditTests(TestCase):
    def test_opening_a_shared_link_is_audited_without_the_token(self):
        owner = make_user('owner@psc.gov.vu')
        record = make_record(owner)
        RecordVersion.objects.create(
            record=record, version_number=1, file_name='a.txt', file_size=1, mime_type='text/plain',
            content_hash='0' * 64, created_by=owner,
        )
        link = SharedLink.objects.create(record=record, created_by=owner, recipient_email='ext@example.org')
        self.assertEqual(APIClient().get(f'/api/sharing/{link.token}/view/').status_code, 200)
        entry = AuditLog.objects.get(action=AuditAction.SHARE_ACCESS)
        self.assertEqual(entry.record_id, record.id)
        self.assertEqual(entry.extra['link_id'], str(link.id))
        self.assertEqual(entry.extra['recipient'], 'ext@example.org')
        self.assertNotIn(link.token, str(entry.extra))
        self.assertIsNone(entry.user_id)

    def test_a_refused_open_is_not_logged_as_access(self):
        owner = make_user('owner2@psc.gov.vu')
        record = make_record(owner)
        link = SharedLink.objects.create(record=record, created_by=owner, is_active=False)
        self.assertEqual(APIClient().get(f'/api/sharing/{link.token}/view/').status_code, 403)
        self.assertFalse(AuditLog.objects.filter(action=AuditAction.SHARE_ACCESS).exists())


# ---------------------------------------------------------------------------
# Destruction certificates
# ---------------------------------------------------------------------------

class DestructionFlowTests(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        self.addCleanup(shutil.rmtree, self.media, ignore_errors=True)
        self.addCleanup(self.override.disable)

        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.director = make_user('director@psc.gov.vu', UserRole.DIRECTOR)
        self.second_director = make_user('director2@psc.gov.vu', UserRole.DIRECTOR)
        self.record = make_record(self.officer)
        approve_for_destruction(self.record, self.director)

    def _full_record(self):
        """A record with a file, an attachment, a passage in the search index, a comment and a share link."""
        record = self.record
        version = RecordVersion.objects.create(
            record=record, version_number=1, file_name='plan.txt', file_size=4, mime_type='text/plain',
            content_hash='a' * 64, ocr_text='secret words', ai_summary='a summary', created_by=self.officer,
        )
        version.file.save('plan.txt', ContentFile(b'data'), save=True)
        attachment = RecordAttachment.objects.create(
            record=record, file_name='annex.txt', file_size=3, mime_type='text/plain',
            content_hash='b' * 64, ocr_text='annex words', uploaded_by=self.officer,
        )
        attachment.file.save('annex.txt', ContentFile(b'xyz'), save=True)
        RecordChunk.objects.create(record=record, chunk_index=0, text='secret words', text_hash='h', embedding=[0.1] * 1024)
        from apps.collaboration.models import Comment
        Comment.objects.create(record=record, author=self.officer, body='discussing the secret words')
        link = SharedLink.objects.create(record=record, created_by=self.officer)
        return version, attachment, link

    def _request(self, records=None, user=None):
        return client_for(user or self.officer).post('/api/compliance/destruction/', {
            'destruction_method': 'Digital deletion', 'notes': 'Retention ended',
            'records': [str(r.pk) for r in (records or [self.record])],
        }, format='json')

    # --- requesting ---------------------------------------------------------

    def test_a_certificate_needs_records(self):
        res = client_for(self.officer).post('/api/compliance/destruction/', {'notes': 'n'}, format='json')
        self.assertEqual(res.status_code, 400)
        res = client_for(self.officer).post('/api/compliance/destruction/', {'notes': 'n', 'records': []}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_request_links_the_records_and_cannot_set_its_own_status(self):
        res = client_for(self.officer).post('/api/compliance/destruction/', {
            'records': [str(self.record.pk)], 'status': 'approved', 'notes': 'n',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        cert = DestructionCertificate.objects.get(pk=res.data['id'])
        self.assertEqual(cert.status, 'pending')
        self.assertEqual(cert.authorised_by, self.officer)
        self.assertEqual(list(cert.destroyed_records.all()), [self.record])

    def test_record_without_an_approved_destroy_review_is_refused(self):
        other = make_record(self.officer, title='No review')
        res = self._request([other])
        self.assertEqual(res.status_code, 400)
        self.assertIn('disposition review', str(res.data))

    def test_archive_review_does_not_allow_destruction(self):
        other = make_record(self.officer, title='To archive')
        DispositionReview.objects.create(record=other, retention_date=date(2020, 1, 1), proposed_action='archive',
                                         status='approved')
        self.assertEqual(self._request([other]).status_code, 400)

    def test_legal_hold_blocks_the_request(self):
        Record.objects.filter(pk=self.record.pk).update(is_on_legal_hold=True)
        res = self._request()
        self.assertEqual(res.status_code, 400)
        self.assertIn('legal hold', str(res.data))

    def test_open_workflow_blocks_the_request(self):
        from apps.workflows.models import WorkflowInstance
        WorkflowInstance.objects.create(record=self.record, title='Review', status='in_progress')
        self.assertIn('workflow', str(self._request().data))

    def test_record_cannot_be_on_two_certificates(self):
        self.assertEqual(self._request().status_code, 201)
        self.assertEqual(self._request().status_code, 400)

    # --- separation of duties ----------------------------------------------

    def test_requester_cannot_approve_their_own_certificate(self):
        requester = make_user('both@psc.gov.vu', UserRole.DIRECTOR)
        cert_id = self._request(user=requester).data['id']
        res = client_for(requester).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'approve'})
        self.assertEqual(res.status_code, 403)
        cert = DestructionCertificate.objects.get(pk=cert_id)
        self.assertEqual(cert.status, 'pending')
        self.assertIsNone(cert.approved_by)

    def test_database_rejects_same_person_as_approver(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            DestructionCertificate.objects.create(authorised_by=self.director, approved_by=self.director)

    def test_a_different_director_can_approve(self):
        cert_id = self._request().data['id']
        res = client_for(self.director).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'approve'})
        self.assertEqual(res.status_code, 200)
        cert = DestructionCertificate.objects.get(pk=cert_id)
        self.assertEqual((cert.status, cert.approved_by), ('approved', self.director))

    def test_approval_and_rejection_are_audited_per_record(self):
        cert_id = self._request().data['id']
        client_for(self.director).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'approve'})
        entry = AuditLog.objects.get(action=AuditAction.APPROVE, extra__event='destruction_approved')
        self.assertEqual(entry.record_id, self.record.id)
        self.assertEqual(entry.user_id, self.director.id)

    def test_reject_records_who_and_releases_the_records(self):
        cert_id = self._request().data['id']
        res = client_for(self.director).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'reject'})
        self.assertEqual(res.status_code, 200)
        cert = DestructionCertificate.objects.get(pk=cert_id)
        self.assertEqual((cert.status, cert.rejected_by), ('rejected', self.director))
        self.assertIsNotNone(cert.rejected_at)
        self.record.refresh_from_db()
        self.assertIsNone(self.record.destruction_certificate_id)
        self.assertTrue(AuditLog.objects.filter(action=AuditAction.REJECT, extra__event='destruction_rejected').exists())
        self.assertEqual(self._request().status_code, 201)  # free to be requested again

    def test_decided_certificate_cannot_be_decided_again(self):
        cert_id = self._request().data['id']
        client_for(self.director).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'reject'})
        res = client_for(self.second_director).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'approve'})
        self.assertEqual(res.status_code, 400)

    def test_unknown_certificate_is_404_not_500(self):
        res = client_for(self.director).post(
            '/api/compliance/destruction/00000000-0000-0000-0000-000000000000/approve/', {'action': 'approve'})
        self.assertEqual(res.status_code, 404)

    def test_invalid_action_is_400(self):
        cert_id = self._request().data['id']
        res = client_for(self.director).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'nope'})
        self.assertEqual(res.status_code, 400)

    # --- execution ----------------------------------------------------------

    def _approved_certificate(self):
        cert_id = self._request().data['id']
        client_for(self.director).post(f'/api/compliance/destruction/{cert_id}/approve/', {'action': 'approve'})
        return DestructionCertificate.objects.get(pk=cert_id)

    def test_pending_certificate_is_not_executed(self):
        cert = DestructionCertificate.objects.get(pk=self._request().data['id'])
        self.assertEqual(execute_destruction(cert.pk)[0], 'skipped')
        self.record.refresh_from_db()
        self.assertIsNone(self.record.erased_at)

    def test_execution_erases_content_and_keeps_the_stub(self):
        version, attachment, link = self._full_record()
        file_name, annex_name = version.file.name, attachment.file.name
        self.assertTrue(default_storage.exists(file_name))

        cert = self._approved_certificate()
        outcome, detail = execute_destruction(cert.pk)
        self.assertEqual((outcome, detail), ('completed', 1))

        # content is gone
        self.assertFalse(default_storage.exists(file_name))
        self.assertFalse(default_storage.exists(annex_name))
        version.refresh_from_db()
        attachment.refresh_from_db()
        self.assertFalse(version.file)
        self.assertEqual((version.ocr_text, version.ai_summary), ('', ''))
        self.assertFalse(attachment.file)
        self.assertEqual(attachment.ocr_text, '')
        self.assertFalse(RecordChunk.objects.filter(record=self.record).exists())
        link.refresh_from_db()
        self.assertFalse(link.is_active)
        self.assertEqual(self.record.comments.get().body.startswith('[Removed'), True)

        # the stub stays
        self.record.refresh_from_db()
        self.assertEqual(self.record.title, 'Old file')
        self.assertEqual((self.record.description, self.record.tags), ('', []))
        self.assertIsNotNone(self.record.erased_at)
        self.assertEqual(version.content_hash, 'a' * 64)
        self.assertEqual(version.file_name, 'plan.txt')

        # certificate completed with a PDF
        cert.refresh_from_db()
        self.assertEqual(cert.status, 'completed')
        self.assertIsNotNone(cert.completed_at)
        self.assertTrue(cert.pdf_file)
        with cert.pdf_file.open('rb') as fh:
            self.assertTrue(fh.read(5).startswith(b'%PDF'))

    def test_execution_is_audited_and_the_chain_stays_valid(self):
        self._full_record()
        cert = self._approved_certificate()
        execute_destruction(cert.pk)
        entry = AuditLog.objects.get(action=AuditAction.DESTROY, extra__event='record_destroyed')
        self.assertEqual(entry.extra['certificate'], cert.certificate_number)
        self.assertEqual(entry.extra['version_hashes'], [{'version': 1, 'sha256': 'a' * 64}])
        self.assertEqual(entry.extra['approved_by'], 'director@psc.gov.vu')
        self.assertTrue(AuditLog.objects.filter(extra__event='destruction_completed').exists())
        call_command('verify_audit_chain', stdout=io.StringIO())

    def test_destroyed_record_is_gone_from_the_app_and_not_in_the_bin(self):
        cert = self._approved_certificate()
        execute_destruction(cert.pk)
        admin = make_user('admin@psc.gov.vu', UserRole.ADMINISTRATOR)
        self.assertEqual(client_for(admin).get(f'/api/records/{self.record.pk}/').status_code, 404)
        self.assertEqual(client_for(admin).get('/api/records/bin/').json()['count'], 0)
        restore = client_for(admin).post('/api/records/bin/restore/', {'record_ids': [str(self.record.pk)]}, format='json')
        self.assertEqual(restore.json()['count'], 0)

    def test_running_it_twice_changes_nothing_more(self):
        cert = self._approved_certificate()
        self.assertEqual(execute_destruction(cert.pk)[0], 'completed')
        self.assertEqual(execute_destruction(cert.pk)[0], 'skipped')
        self.assertEqual(AuditLog.objects.filter(extra__event='record_destroyed').count(), 1)

    def test_legal_hold_applied_after_approval_blocks_execution(self):
        cert = self._approved_certificate()
        hold = LegalHold.objects.create(title='Inquiry', reason='r', hold_type='inquiry', applied_by=self.director)
        hold.records.add(self.record)
        Record.objects.filter(pk=self.record.pk).update(is_on_legal_hold=True)

        outcome, blockers = execute_destruction(cert.pk)
        self.assertEqual(outcome, 'blocked')
        self.assertIn('legal hold', blockers[self.record.reference_number])
        cert.refresh_from_db()
        self.record.refresh_from_db()
        self.assertEqual(cert.status, 'approved')
        self.assertIsNone(self.record.erased_at)
        self.assertTrue(AuditLog.objects.filter(extra__event='destruction_blocked').exists())

        # once the hold is lifted the next run goes through
        hold.lift(self.director)
        self.assertEqual(execute_destruction(cert.pk)[0], 'completed')

    def test_record_binned_after_approval_blocks_execution(self):
        cert = self._approved_certificate()
        Record.objects.filter(pk=self.record.pk).update(destroyed_at=timezone.now(), deleted_at=timezone.now())
        outcome, blockers = execute_destruction(cert.pk)
        self.assertEqual(outcome, 'blocked')
        self.assertIn('Recycle bin', str(blockers))

    def test_daily_sweep_runs_approved_certificates(self):
        from apps.compliance.tasks import execute_approved_destructions
        cert = self._approved_certificate()
        execute_approved_destructions()
        cert.refresh_from_db()
        self.assertEqual(cert.status, 'completed')
