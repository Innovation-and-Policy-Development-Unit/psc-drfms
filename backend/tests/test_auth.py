"""
Authentication & user-management tests.

Run:  python manage.py test tests.test_auth --settings=config.settings.development
"""
import json
from datetime import timedelta
from unittest.mock import patch, MagicMock

from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, Department, UserRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email='officer@psc.gov.vu', role=UserRole.RECORDS_OFFICER, **kwargs):
    return User.objects.create_user(
        email=email,
        username=email.split('@')[0],
        first_name='Test',
        last_name='User',
        password='Secur3Pass!',
        role=role,
        **kwargs,
    )


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# Login / lockout tests
# ---------------------------------------------------------------------------

class LoginTests(TestCase):
    def setUp(self):
        self.user = make_user()
        self.client = APIClient()
        self.url = '/api/auth/token/'

    def test_successful_login_returns_tokens(self):
        resp = self.client.post(self.url, {'email': self.user.email, 'password': 'Secur3Pass!'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

    def test_wrong_password_returns_401(self):
        resp = self.client.post(self.url, {'email': self.user.email, 'password': 'wrongpass'})
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_failed_login_increments_counter(self):
        for _ in range(3):
            self.client.post(self.url, {'email': self.user.email, 'password': 'wrong'})
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_count, 3)

    def test_account_locked_after_5_failures(self):
        for _ in range(5):
            self.client.post(self.url, {'email': self.user.email, 'password': 'wrong'})
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.account_locked_until)
        self.assertTrue(self.user.is_account_locked)

    def test_locked_account_blocked_before_auth(self):
        self.user.account_locked_until = timezone.now() + timedelta(minutes=30)
        self.user.failed_login_count = 5
        self.user.save()
        resp = self.client.post(self.url, {'email': self.user.email, 'password': 'Secur3Pass!'})
        self.assertEqual(resp.status_code, status.HTTP_423_LOCKED)

    def test_successful_login_resets_failed_count(self):
        self.user.failed_login_count = 3
        self.user.save()
        self.client.post(self.url, {'email': self.user.email, 'password': 'Secur3Pass!'})
        self.user.refresh_from_db()
        self.assertEqual(self.user.failed_login_count, 0)

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save()
        resp = self.client.post(self.url, {'email': self.user.email, 'password': 'Secur3Pass!'})
        self.assertIn(resp.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_400_BAD_REQUEST])

    def test_login_returns_role_and_2fa_flag(self):
        resp = self.client.post(self.url, {'email': self.user.email, 'password': 'Secur3Pass!'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('role', resp.data)
        self.assertIn('requires_2fa', resp.data)
        self.assertEqual(resp.data['role'], UserRole.RECORDS_OFFICER)
        self.assertFalse(resp.data['requires_2fa'])


# ---------------------------------------------------------------------------
# 2FA tests
# ---------------------------------------------------------------------------

class TwoFactorTests(TestCase):
    def setUp(self):
        self.user = make_user(is_2fa_required=True)
        self.client = auth_client(self.user)
        self.verify_url = '/api/auth/2fa/verify/'

    @patch('apps.accounts.views.TOTPDevice')
    @patch('apps.accounts.views.pyotp')
    def test_valid_otp_returns_new_tokens(self, mock_pyotp, mock_totp_device):
        device = MagicMock()
        mock_totp_device.objects.get.return_value = device
        mock_totp = MagicMock()
        mock_totp.verify.return_value = True
        mock_pyotp.TOTP.return_value = mock_totp

        resp = self.client.post(self.verify_url, {'otp': '123456'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

    @patch('apps.accounts.views.TOTPDevice')
    @patch('apps.accounts.views.pyotp')
    def test_invalid_otp_returns_400(self, mock_pyotp, mock_totp_device):
        device = MagicMock()
        mock_totp_device.objects.get.return_value = device
        mock_totp = MagicMock()
        mock_totp.verify.return_value = False
        mock_pyotp.TOTP.return_value = mock_totp

        resp = self.client.post(self.verify_url, {'otp': '000000'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# User management tests
# ---------------------------------------------------------------------------

class UserManagementTests(TestCase):
    def setUp(self):
        self.admin = make_user(email='admin@psc.gov.vu', role=UserRole.ADMINISTRATOR)
        self.officer = make_user(email='officer@psc.gov.vu', role=UserRole.RECORDS_OFFICER)
        self.admin_client = auth_client(self.admin)
        self.officer_client = auth_client(self.officer)

    def test_admin_can_list_users(self):
        resp = self.admin_client.get('/api/auth/users/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_officer_cannot_list_users(self):
        resp = self.officer_client.get('/api/auth/users/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_user(self):
        payload = {
            'email': 'new@psc.gov.vu',
            'username': 'newuser',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'Secur3Pass!',
            'role': UserRole.REVIEWER,
        }
        resp = self.admin_client.post('/api/auth/users/', payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='new@psc.gov.vu').exists())

    def test_suspend_user_blacklists_tokens(self):
        resp = self.admin_client.post(f'/api/auth/users/{self.officer.pk}/suspend/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.officer.refresh_from_db()
        self.assertFalse(self.officer.is_active)

    def test_me_endpoint_returns_current_user(self):
        resp = self.officer_client.get('/api/auth/me/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['email'], self.officer.email)

    def test_password_change_requires_old_password(self):
        resp = self.officer_client.post('/api/auth/password/change/', {
            'old_password': 'wrongold',
            'new_password': 'NewSecur3Pass!',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_change_succeeds(self):
        resp = self.officer_client.post('/api/auth/password/change/', {
            'old_password': 'Secur3Pass!',
            'new_password': 'NewSecur3Pass!',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.officer.refresh_from_db()
        self.assertTrue(self.officer.check_password('NewSecur3Pass!'))


# ---------------------------------------------------------------------------
# Delegation tests
# ---------------------------------------------------------------------------

class DelegationTests(TestCase):
    def setUp(self):
        self.delegator = make_user(email='delegator@psc.gov.vu', role=UserRole.DIRECTOR)
        self.delegate = make_user(email='delegate@psc.gov.vu', role=UserRole.RECORDS_OFFICER)
        self.client = auth_client(self.delegator)

    def test_set_delegation(self):
        resp = self.client.post('/api/auth/delegation/', {
            'delegate_to': self.delegate.pk,
            'delegate_until': (timezone.now() + timedelta(days=7)).isoformat(),
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.delegator.refresh_from_db()
        self.assertEqual(self.delegator.delegate_to, self.delegate)

    def test_cannot_delegate_to_self(self):
        resp = self.client.post('/api/auth/delegation/', {
            'delegate_to': self.delegator.pk,
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_remove_delegation(self):
        self.delegator.delegate_to = self.delegate
        self.delegator.save()
        resp = self.client.delete('/api/auth/delegation/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.delegator.refresh_from_db()
        self.assertIsNone(self.delegator.delegate_to)
