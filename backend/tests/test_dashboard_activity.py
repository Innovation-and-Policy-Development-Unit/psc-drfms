"""
Dashboard activity chart and team feed: correct numbers, and nothing about
records the viewer cannot see.

Run:  python manage.py test tests.test_dashboard_activity --settings=config.settings.development
"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.audit.models import AuditLog
from apps.records.models import Record, RecordVersion


def make_user(email, role, first='T', last='U'):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name=first, last_name=last,
        password='Secur3Pass!', role=role,
    )


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def add_version(record, user, when=None):
    v = RecordVersion.objects.create(
        record=record, version_number=record.versions.count() + 1, file='x.txt', file_name='x.txt',
        file_size=1, mime_type='text/plain', content_hash=f'h{record.versions.count()}{record.pk}', created_by=user,
    )
    if when:
        RecordVersion.objects.filter(pk=v.pk).update(created_at=when)
    return v


def log(user, action, record, when=None):
    entry = AuditLog.objects.create(user=user, action=action, record=record, record_reference=record.reference_number)
    if when:
        AuditLog.objects.filter(pk=entry.pk).update(timestamp=when)
    return entry


class ActivityTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR, 'Ada', 'Admin')
        self.reader = make_user('reader@t.gov.vu', UserRole.READ_ONLY, 'Rae', 'Reader')
        self.open = Record.objects.create(title='Public circular', classification_level='internal', custodian=self.admin, author=self.admin)
        self.secret = Record.objects.create(title='Secret file', classification_level='secret', custodian=self.admin, author=self.admin)

    def test_requires_auth(self):
        self.assertEqual(APIClient().get('/api/analytics/activity/').status_code, 401)
        self.assertEqual(APIClient().get('/api/analytics/team-feed/').status_code, 401)

    def test_series_covers_each_day_in_range(self):
        for days in (7, 14, 30, 90):
            data = client_for(self.admin).get('/api/analytics/activity/', {'days': days}).json()
            self.assertEqual((data['days'], len(data['series'])), (days, days))
        self.assertEqual(client_for(self.admin).get('/api/analytics/activity/', {'days': 5}).json()['days'], 14)
        self.assertEqual(client_for(self.admin).get('/api/analytics/activity/', {'days': 'x'}).json()['days'], 14)

    def test_counts_uploads_and_edits_per_day(self):
        add_version(self.open, self.admin)
        add_version(self.open, self.admin)
        log(self.admin, 'update', self.open)
        log(self.admin, 'view', self.open)      # views are not edits
        data = client_for(self.admin).get('/api/analytics/activity/', {'days': 7}).json()
        today = data['series'][-1]
        self.assertEqual((today['uploads'], today['edits']), (2, 1))
        self.assertEqual(sum(d['uploads'] for d in data['series'][:-1]), 0)

    def test_activity_on_hidden_records_is_not_counted_for_the_viewer(self):
        add_version(self.secret, self.admin)
        log(self.admin, 'update', self.secret)
        admin_today = client_for(self.admin).get('/api/analytics/activity/', {'days': 7}).json()['series'][-1]
        reader_today = client_for(self.reader).get('/api/analytics/activity/', {'days': 7}).json()['series'][-1]
        self.assertEqual((admin_today['uploads'], admin_today['edits']), (1, 1))
        self.assertEqual((reader_today['uploads'], reader_today['edits']), (0, 0))

    def test_old_activity_falls_outside_the_range(self):
        add_version(self.open, self.admin, when=timezone.now() - timedelta(days=20))
        data = client_for(self.admin).get('/api/analytics/activity/', {'days': 7}).json()
        self.assertEqual(sum(d['uploads'] for d in data['series']), 0)
        wide = client_for(self.admin).get('/api/analytics/activity/', {'days': 30}).json()
        self.assertEqual(sum(d['uploads'] for d in wide['series']), 1)

    def test_trend_compares_with_previous_period(self):
        # 2 records inside the last 7 days (setUp made 2 live ones today, 1 visible to the reader)
        Record.objects.filter(pk=self.open.pk).update(created_at=timezone.now() - timedelta(days=10))
        Record.objects.filter(pk=self.secret.pk).update(created_at=timezone.now() - timedelta(days=10))
        r = Record.objects.create(title='New 1', classification_level='internal', custodian=self.admin, author=self.admin)
        Record.objects.create(title='New 2', classification_level='internal', custodian=self.admin, author=self.admin)
        data = client_for(self.admin).get('/api/analytics/activity/', {'days': 7}).json()
        # 2 now vs 2 in the previous 7 days (the two backdated ones) = 0%
        self.assertEqual((data['recordsAdded'], data['previousRecordsAdded'], data['recordsTrendPct']), (2, 2, 0))
        Record.objects.filter(pk=r.pk).update(created_at=timezone.now() - timedelta(days=10))
        up = client_for(self.admin).get('/api/analytics/activity/', {'days': 7}).json()
        self.assertEqual((up['recordsAdded'], up['previousRecordsAdded'], up['recordsTrendPct']), (1, 3, -67))

    def test_trend_is_null_with_nothing_to_compare(self):
        data = client_for(self.admin).get('/api/analytics/activity/', {'days': 7}).json()
        self.assertIsNone(data['recordsTrendPct'])

    def test_team_feed_shows_meaningful_actions_newest_first(self):
        log(self.admin, 'view', self.open)       # noise, excluded
        log(self.admin, 'login', self.open)      # noise, excluded
        log(self.admin, 'create', self.open, when=timezone.now() - timedelta(hours=2))
        log(self.admin, 'share', self.open, when=timezone.now() - timedelta(hours=1))
        feed = client_for(self.reader).get('/api/analytics/team-feed/').json()
        self.assertEqual([f['action'] for f in feed], ['share', 'create'])
        self.assertEqual(feed[0]['userName'], 'Ada Admin')
        self.assertEqual(feed[0]['recordTitle'], 'Public circular')

    def test_team_feed_hides_actions_on_records_the_viewer_cannot_see(self):
        log(self.admin, 'update', self.secret)
        log(self.admin, 'update', self.open)
        reader_feed = client_for(self.reader).get('/api/analytics/team-feed/').json()
        admin_feed = client_for(self.admin).get('/api/analytics/team-feed/').json()
        self.assertEqual([f['recordTitle'] for f in reader_feed], ['Public circular'])
        self.assertEqual(len(admin_feed), 2)

    def test_team_feed_limit_is_capped(self):
        for _ in range(30):
            log(self.admin, 'update', self.open)
        self.assertEqual(len(client_for(self.admin).get('/api/analytics/team-feed/', {'limit': 500}).json()), 20)
        self.assertEqual(len(client_for(self.admin).get('/api/analytics/team-feed/', {'limit': 3}).json()), 3)
