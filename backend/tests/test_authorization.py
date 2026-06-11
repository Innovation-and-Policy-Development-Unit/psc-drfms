"""
Object-level authorization + share-link password tests.

Run:  python manage.py test tests.test_authorization --settings=config.settings.development
"""
from django.contrib.auth.hashers import make_password
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta

from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.records.models import Record, DocumentPermission
from apps.records import authorization as authz
from apps.sharing.models import SharedLink


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


def make_record(owner, **kwargs):
    defaults = dict(
        title='Authz Record',
        document_type='policy',
        classification_level='internal',
        author=owner,
        custodian=owner,
    )
    defaults.update(kwargs)
    r = Record(**defaults)
    r.save()
    return r


class ClassificationMatrixTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.read_only = make_user('ro@psc.gov.vu', UserRole.READ_ONLY)
        self.reviewer = make_user('rev@psc.gov.vu', UserRole.REVIEWER)
        self.commissioner = make_user('comm@psc.gov.vu', UserRole.COMMISSIONER)

    def test_read_only_can_view_internal(self):
        rec = make_record(self.officer, classification_level='internal')
        self.assertTrue(authz.can_view(self.read_only, rec))

    def test_read_only_cannot_view_confidential(self):
        rec = make_record(self.officer, classification_level='confidential')
        self.assertFalse(authz.can_view(self.read_only, rec))

    def test_reviewer_can_view_confidential_not_secret(self):
        conf = make_record(self.officer, classification_level='confidential')
        secret = make_record(self.officer, classification_level='secret', title='S')
        self.assertTrue(authz.can_view(self.reviewer, conf))
        self.assertFalse(authz.can_view(self.reviewer, secret))

    def test_officer_cannot_view_secret(self):
        secret = make_record(self.commissioner, classification_level='secret')
        self.assertFalse(authz.can_view(self.officer, secret))

    def test_custodian_views_own_record_above_clearance(self):
        secret = make_record(self.officer, classification_level='secret')
        self.assertTrue(authz.can_view(self.officer, secret))

    def test_commissioner_views_secret(self):
        secret = make_record(self.officer, classification_level='secret')
        self.assertTrue(authz.can_view(self.commissioner, secret))


class DocumentPermissionGrantTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.read_only = make_user('ro@psc.gov.vu', UserRole.READ_ONLY)
        self.secret = make_record(self.officer, classification_level='secret')

    def test_grant_allows_view(self):
        DocumentPermission.objects.create(
            record=self.secret, user=self.read_only, can_view=True, granted_by=self.officer,
        )
        self.assertTrue(authz.can_view(self.read_only, self.secret))

    def test_expired_grant_denies(self):
        DocumentPermission.objects.create(
            record=self.secret, user=self.read_only, can_view=True,
            granted_by=self.officer, expires_at=timezone.now() - timedelta(days=1),
        )
        self.assertFalse(authz.can_view(self.read_only, self.secret))

    def test_grant_without_edit_denies_edit(self):
        DocumentPermission.objects.create(
            record=self.secret, user=self.read_only, can_view=True, can_edit=False,
            granted_by=self.officer,
        )
        self.assertFalse(authz.can_edit(self.read_only, self.secret))


class RecordApiEnforcementTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.read_only = make_user('ro@psc.gov.vu', UserRole.READ_ONLY)
        self.secret = make_record(self.officer, classification_level='secret', title='Secret doc')
        self.internal = make_record(self.officer, classification_level='internal', title='Internal doc')

    def test_list_hides_secret_from_read_only(self):
        res = auth_client(self.read_only).get('/api/records/')
        titles = [r['title'] for r in (res.data.get('results') or res.data)]
        self.assertIn('Internal doc', titles)
        self.assertNotIn('Secret doc', titles)

    def test_detail_denied_above_clearance(self):
        res = auth_client(self.read_only).get(f'/api/records/{self.secret.id}/')
        self.assertEqual(res.status_code, 403)

    def test_read_only_cannot_patch(self):
        res = auth_client(self.read_only).patch(
            f'/api/records/{self.internal.id}/', {'title': 'Hacked'}, format='json',
        )
        self.assertEqual(res.status_code, 403)

    def test_read_only_cannot_delete(self):
        res = auth_client(self.read_only).delete(f'/api/records/{self.internal.id}/')
        self.assertEqual(res.status_code, 403)

    def test_officer_can_patch_within_clearance(self):
        res = auth_client(self.officer).patch(
            f'/api/records/{self.internal.id}/', {'title': 'Renamed'}, format='json',
        )
        self.assertEqual(res.status_code, 200)

    def test_search_hides_secret(self):
        res = auth_client(self.read_only).get('/api/search/', {'q': 'doc'})
        titles = [r.get('title') for r in res.data.get('results', [])]
        self.assertNotIn('Secret doc', titles)


class SharedLinkPasswordTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.record = make_record(self.officer)
        self.link = SharedLink.objects.create(
            record=self.record, created_by=self.officer,
            password=make_password('s3cret-share'),
        )
        self.open_link = SharedLink.objects.create(
            record=self.record, created_by=self.officer,
        )
        self.client_anon = APIClient()

    def test_view_without_password_returns_401(self):
        res = self.client_anon.get(f'/api/sharing/{self.link.token}/view/')
        self.assertEqual(res.status_code, 401)
        self.assertTrue(res.data.get('password_required'))

    def test_view_with_wrong_password_returns_401(self):
        res = self.client_anon.get(
            f'/api/sharing/{self.link.token}/view/', HTTP_X_SHARE_PASSWORD='nope',
        )
        self.assertEqual(res.status_code, 401)

    def test_view_with_correct_password_succeeds(self):
        res = self.client_anon.get(
            f'/api/sharing/{self.link.token}/view/', HTTP_X_SHARE_PASSWORD='s3cret-share',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['title'], self.record.title)

    def test_unprotected_link_works(self):
        res = self.client_anon.get(f'/api/sharing/{self.open_link.token}/view/')
        self.assertEqual(res.status_code, 200)

    def test_public_payload_is_minimal(self):
        res = self.client_anon.get(f'/api/sharing/{self.open_link.token}/view/')
        self.assertNotIn('permissions', res.data)
        self.assertNotIn('custodian', res.data)

    def test_download_blocked_when_not_allowed(self):
        res = self.client_anon.get(f'/api/sharing/{self.open_link.token}/download/')
        self.assertEqual(res.status_code, 403)

    def test_create_link_requires_share_access(self):
        ro = make_user('ro@psc.gov.vu', UserRole.READ_ONLY)
        res = auth_client(ro).post(
            '/api/sharing/', {'record': str(self.record.id)}, format='json',
        )
        self.assertEqual(res.status_code, 403)


class AdminPasswordResetTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@psc.gov.vu', UserRole.ADMINISTRATOR)
        self.target = make_user('target@psc.gov.vu', UserRole.READ_ONLY)

    def test_admin_can_reset_password(self):
        res = auth_client(self.admin).post(
            f'/api/auth/users/{self.target.id}/reset-password/',
            {'new_password': 'NewSecure123!'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.target.refresh_from_db()
        self.assertTrue(self.target.check_password('NewSecure123!'))

    def test_short_password_rejected(self):
        res = auth_client(self.admin).post(
            f'/api/auth/users/{self.target.id}/reset-password/',
            {'new_password': 'short'}, format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_non_admin_denied(self):
        res = auth_client(self.target).post(
            f'/api/auth/users/{self.admin.id}/reset-password/',
            {'new_password': 'NewSecure123!'}, format='json',
        )
        self.assertEqual(res.status_code, 403)
