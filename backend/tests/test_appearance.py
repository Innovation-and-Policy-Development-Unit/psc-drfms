"""
Appearance API: per-user choice, organisation default, administrator lock.

Run:  python manage.py test tests.test_appearance --settings=config.settings.development
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.core.models import AppearanceSettings


def make_user(email, role):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name='T', last_name='U',
        password='Secur3Pass!', role=role,
    )


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class AppearanceApiTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR)
        self.officer = make_user('officer@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.admin_c, self.officer_c = client_for(self.admin), client_for(self.officer)

    def test_requires_auth(self):
        self.assertEqual(APIClient().get('/api/appearance/').status_code, 401)

    def test_defaults(self):
        data = self.officer_c.get('/api/appearance/').json()
        self.assertEqual(data['org'], {
            'theme': 'psc-blue', 'mode': 'light', 'density': 'comfortable', 'radius': 'default', 'locked': False,
        })
        self.assertEqual(data['user'], {})

    def test_user_saves_and_merges_choices(self):
        self.officer_c.put('/api/appearance/me/', {'theme': 'violet', 'mode': 'dark'}, format='json')
        res = self.officer_c.patch('/api/appearance/me/', {'density': 'compact'}, format='json')
        self.assertEqual(res.json(), {'theme': 'violet', 'mode': 'dark', 'density': 'compact'})
        self.assertEqual(self.officer_c.get('/api/appearance/').json()['user']['theme'], 'violet')

    def test_choices_are_per_user(self):
        self.officer_c.put('/api/appearance/me/', {'theme': 'rose'}, format='json')
        self.assertEqual(self.admin_c.get('/api/appearance/').json()['user'], {})

    def test_invalid_values_rejected(self):
        for body in ({'mode': 'neon'}, {'density': 'tiny'}, {'radius': 'blob'}, {'theme': 'Not A Slug!'}, {'theme': ''}):
            self.assertEqual(self.officer_c.put('/api/appearance/me/', body, format='json').status_code, 400, body)

    def test_reset_clears_personal_choices(self):
        self.officer_c.put('/api/appearance/me/', {'theme': 'rose'}, format='json')
        self.officer_c.delete('/api/appearance/me/')
        self.assertEqual(self.officer_c.get('/api/appearance/').json()['user'], {})

    def test_only_administrators_change_org_default(self):
        self.assertEqual(self.officer_c.put('/api/appearance/org/', {'theme': 'teal'}, format='json').status_code, 403)
        res = self.admin_c.put('/api/appearance/org/', {'theme': 'teal', 'mode': 'dark'}, format='json')
        self.assertEqual((res.status_code, res.json()['theme'], res.json()['mode']), (200, 'teal', 'dark'))
        self.assertEqual(AppearanceSettings.load().updated_by, self.admin)
        self.assertEqual(self.officer_c.get('/api/appearance/').json()['org']['theme'], 'teal')

    def test_lock_blocks_personal_changes(self):
        self.admin_c.put('/api/appearance/org/', {'theme': 'slate', 'locked': True}, format='json')
        self.assertTrue(self.officer_c.get('/api/appearance/').json()['org']['locked'])
        res = self.officer_c.put('/api/appearance/me/', {'theme': 'rose'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(self.officer_c.get('/api/appearance/').json()['user'], {})

    def test_unlock_restores_personal_choice(self):
        self.admin_c.put('/api/appearance/org/', {'locked': True}, format='json')
        self.admin_c.put('/api/appearance/org/', {'locked': False}, format='json')
        res = self.officer_c.put('/api/appearance/me/', {'theme': 'rose'}, format='json')
        self.assertEqual(res.status_code, 200)
