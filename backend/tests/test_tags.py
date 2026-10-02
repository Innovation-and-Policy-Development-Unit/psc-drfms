"""
Tags: tidy values, a counted list that only covers visible records, and a list filter.

Run:  python manage.py test tests.test_tags --settings=config.settings.development
"""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
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


class TagTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR)
        self.officer = make_user('officer@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY)

        def rec(title, tags, level='internal'):
            return Record.objects.create(title=title, tags=tags, classification_level=level, custodian=self.admin, author=self.admin)

        self.a = rec('A', ['budget', 'finance'])
        self.b = rec('B', ['budget'])
        self.c = rec('C', ['hr'], level='secret')
        self.d = rec('D', [])

    def test_requires_auth(self):
        self.assertEqual(APIClient().get('/api/records/tags/').status_code, 401)

    def test_counts_most_used_first(self):
        data = client_for(self.admin).get('/api/records/tags/').json()
        self.assertEqual(data, [{'tag': 'budget', 'count': 2}, {'tag': 'finance', 'count': 1}, {'tag': 'hr', 'count': 1}])

    def test_tags_on_records_the_viewer_cannot_see_are_hidden(self):
        data = client_for(self.reader).get('/api/records/tags/').json()
        self.assertEqual({t['tag'] for t in data}, {'budget', 'finance'})  # 'hr' is on a secret record

    def test_destroyed_records_are_not_counted(self):
        from django.utils import timezone
        Record.objects.filter(pk=self.b.pk).update(destroyed_at=timezone.now())
        data = {t['tag']: t['count'] for t in client_for(self.admin).get('/api/records/tags/').json()}
        self.assertEqual(data['budget'], 1)

    def test_malformed_stored_tags_do_not_break_the_list(self):
        Record.objects.filter(pk=self.d.pk).update(tags={'not': 'a list'})
        self.assertEqual(client_for(self.admin).get('/api/records/tags/').status_code, 200)

    def test_list_filters_by_tag(self):
        data = client_for(self.admin).get('/api/records/', {'tag': 'budget'}).json()
        titles = sorted(r['title'] for r in (data['results'] if isinstance(data, dict) else data))
        self.assertEqual(titles, ['A', 'B'])

    def test_filter_respects_visibility(self):
        data = client_for(self.reader).get('/api/records/', {'tag': 'hr'}).json()
        self.assertEqual(len(data['results'] if isinstance(data, dict) else data), 0)

    def test_editing_normalises_tags(self):
        res = client_for(self.officer).patch(
            f'/api/records/{self.a.pk}/', {'tags': ['  Budget ', 'BUDGET', 'New   Tag', '']}, format='json',
        )
        # officers may edit records they can see; A is internal and the officer has clearance
        self.assertEqual(res.status_code, 200, res.content)
        self.a.refresh_from_db()
        self.assertEqual(self.a.tags, ['budget', 'new tag'])

    def test_editing_rejects_bad_tags(self):
        c = client_for(self.admin)
        for bad in ({'tags': 'budget'}, {'tags': [1]}, {'tags': ['x' * 41]}, {'tags': [f't{i}' for i in range(21)]}):
            self.assertEqual(c.patch(f'/api/records/{self.a.pk}/', bad, format='json').status_code, 400, bad)
        self.a.refresh_from_db()
        self.assertEqual(self.a.tags, ['budget', 'finance'])
