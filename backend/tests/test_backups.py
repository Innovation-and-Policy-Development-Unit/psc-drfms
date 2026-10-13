"""
Backup to a Windows share: encryption, scheduling, validation, permissions and run bookkeeping.

Run:  python manage.py test tests.test_backups --settings=config.settings.development
"""
import io
import os
from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User, UserRole
from apps.backups import schedule, streamcrypt, tasks
from apps.backups.models import BackupRun, BackupSettings, RunStatus

PASS = 'correct horse battery'
TZ = ZoneInfo('Pacific/Efate')


def make_user(email, role):
    return User.objects.create_user(
        email=email, username=email.split('@')[0], first_name='T', last_name='U',
        password='Secur3Pass!', role=role,
    )


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def roundtrip(data, passphrase=PASS):
    enc = streamcrypt.Encryptor(passphrase)
    sealed = io.BytesIO()
    enc.encrypt(io.BytesIO(data), sealed)
    return sealed.getvalue()


def open_up(sealed, passphrase=PASS):
    out = io.BytesIO()
    streamcrypt.decrypt(passphrase, io.BytesIO(sealed), out)
    return out.getvalue()


class StreamCryptTests(SimpleTestCase):
    def test_round_trips_at_every_chunk_boundary(self):
        c = streamcrypt.CHUNK
        for size in (0, 1, 100, c - 1, c, c + 1, 2 * c, 2 * c + 7):
            data = os.urandom(size)
            sealed = roundtrip(data)
            self.assertEqual(open_up(sealed), data, size)
            self.assertEqual(len(sealed), streamcrypt.encrypted_size(size), size)

    def test_ciphertext_hides_content(self):
        sealed = roundtrip(b'CLASSIFIED' * 50)
        self.assertNotIn(b'CLASSIFIED', sealed)

    def test_wrong_passphrase_is_rejected(self):
        with self.assertRaises(streamcrypt.DecryptionError):
            open_up(roundtrip(b'secret'), 'another passphrase!!')

    def test_tampering_is_detected(self):
        sealed = bytearray(roundtrip(os.urandom(5000)))
        sealed[-20] ^= 1
        with self.assertRaises(streamcrypt.DecryptionError):
            open_up(bytes(sealed))

    def test_truncation_on_a_chunk_boundary_is_detected(self):
        c = streamcrypt.CHUNK
        sealed = roundtrip(os.urandom(2 * c + 10))
        cut = streamcrypt.HEADER_LEN + c + streamcrypt.TAG_LEN
        with self.assertRaises(streamcrypt.DecryptionError):
            open_up(sealed[:cut])

    def test_chunk_reordering_is_detected(self):
        c = streamcrypt.CHUNK
        step = c + streamcrypt.TAG_LEN
        sealed = roundtrip(os.urandom(3 * c))
        head, body = sealed[:streamcrypt.HEADER_LEN], sealed[streamcrypt.HEADER_LEN:]
        swapped = head + body[step:2 * step] + body[:step] + body[2 * step:]
        with self.assertRaises(streamcrypt.DecryptionError):
            open_up(swapped)

    def test_non_backup_file_is_refused(self):
        with self.assertRaises(streamcrypt.DecryptionError):
            open_up(b'just some text that is long enough to have a header in it')


class ScheduleTests(SimpleTestCase):
    def cfg(self, **kw):
        return BackupSettings(run_hour=1, weekday=6, frequency='daily', **kw)

    def test_latest_slot_is_today_once_the_hour_has_passed(self):
        now = datetime(2026, 10, 13, 15, 0, tzinfo=TZ)
        self.assertEqual(schedule.latest_slot(self.cfg(), now), datetime(2026, 10, 13, 1, 0, tzinfo=TZ))

    def test_latest_slot_is_yesterday_before_the_hour(self):
        now = datetime(2026, 10, 13, 0, 30, tzinfo=TZ)
        self.assertEqual(schedule.latest_slot(self.cfg(), now), datetime(2026, 10, 12, 1, 0, tzinfo=TZ))

    def test_weekly_uses_the_chosen_weekday(self):
        cfg = BackupSettings(run_hour=1, weekday=6, frequency='weekly')  # Sunday
        now = datetime(2026, 10, 13, 15, 0, tzinfo=TZ)  # a Tuesday
        self.assertEqual(schedule.latest_slot(cfg, now).weekday(), 6)
        self.assertEqual(schedule.next_slot(cfg, now), datetime(2026, 10, 18, 1, 0, tzinfo=TZ))

    def test_next_slot_rolls_to_tomorrow(self):
        now = datetime(2026, 10, 13, 15, 0, tzinfo=TZ)
        self.assertEqual(schedule.next_slot(self.cfg(), now), datetime(2026, 10, 14, 1, 0, tzinfo=TZ))


class DueAndOverdueTests(TestCase):
    def setUp(self):
        self.cfg = BackupSettings.load()
        self.cfg.enabled = True
        self.cfg.server, self.cfg.share, self.cfg.username = 'fs.psc.local', 'backups', 'svc'
        self.cfg.password = 'x'
        self.cfg.run_hour = 1
        self.cfg.save()
        BackupSettings.objects.filter(pk=1).update(updated_at=timezone.now() - timedelta(days=10))
        self.cfg.refresh_from_db()
        self.now = timezone.localtime().replace(hour=15, minute=5, second=0, microsecond=0)

    def test_due_when_the_slot_passed_with_no_scheduled_run(self):
        self.assertTrue(tasks.is_due(self.cfg, self.now))

    def test_catches_up_after_the_scheduler_was_down(self):
        self.assertTrue(tasks.is_due(self.cfg, self.now + timedelta(days=2)))

    def test_not_due_twice_for_the_same_slot(self):
        BackupRun.objects.create(trigger='scheduled', status=RunStatus.SUCCESS)
        self.assertFalse(tasks.is_due(self.cfg, timezone.now()))

    def test_manual_runs_do_not_satisfy_the_schedule(self):
        BackupRun.objects.create(trigger='manual', status=RunStatus.SUCCESS)
        self.assertTrue(tasks.is_due(self.cfg, self.now))

    def test_settings_changed_after_the_slot_wait_for_the_next_one(self):
        BackupSettings.objects.filter(pk=1).update(updated_at=self.now - timedelta(hours=1))
        self.cfg.refresh_from_db()
        self.assertFalse(tasks.is_due(self.cfg, self.now))

    def test_switched_off_is_never_due(self):
        self.cfg.enabled = False
        self.assertFalse(tasks.is_due(self.cfg, self.now))

    def test_overdue_when_no_success_for_over_a_period_plus_grace(self):
        self.assertTrue(tasks.is_overdue(self.cfg, timezone.now()))
        BackupRun.objects.create(trigger='scheduled', status=RunStatus.SUCCESS, finished_at=timezone.now())
        self.assertFalse(tasks.is_overdue(self.cfg, timezone.now()))
        self.assertTrue(tasks.is_overdue(self.cfg, timezone.now() + timedelta(days=3)))

    def test_orphaned_running_rows_are_marked_failed(self):
        run = BackupRun.objects.create(trigger='manual')
        BackupRun.objects.filter(pk=run.pk).update(started_at=timezone.now() - tasks.STALE_AFTER - timedelta(minutes=1))
        self.assertIsNone(tasks.active_run())
        run.refresh_from_db()
        self.assertEqual(run.status, RunStatus.FAILED)
        self.assertIn('Interrupted', run.error)


class SettingsApiTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR)
        self.officer = make_user('officer@t.gov.vu', UserRole.RECORDS_OFFICER)
        self.url = '/api/backups/settings/'

    def test_only_administrators_can_read_or_change_settings(self):
        c = client_for(self.officer)
        self.assertEqual(c.get(self.url).status_code, 403)
        self.assertEqual(c.put(self.url, {'server': 'x'}, format='json').status_code, 403)
        self.assertEqual(c.post('/api/backups/runs/').status_code, 403)

    def test_secrets_are_never_returned(self):
        res = client_for(self.admin).put(self.url, {
            'server': 'fs.psc.local', 'share': 'backups', 'username': 'svc', 'password': 'S3cret-pw',
            'encrypt': True, 'passphrase': PASS,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['has_password'] and res.data['has_passphrase'])
        self.assertNotIn('S3cret-pw', str(res.data))
        self.assertNotIn(PASS, str(res.data))
        self.assertNotEqual(BackupSettings.load().password_enc, 'S3cret-pw')
        self.assertEqual(BackupSettings.load().password, 'S3cret-pw')

    def test_blank_password_keeps_the_saved_one(self):
        c = client_for(self.admin)
        c.put(self.url, {'server': 'fs.psc.local', 'share': 'b', 'username': 'svc', 'password': 'S3cret-pw'}, format='json')
        c.put(self.url, {'password': '', 'frequency': 'weekly'}, format='json')
        self.assertEqual(BackupSettings.load().password, 'S3cret-pw')

    def test_cannot_enable_without_a_connection(self):
        res = client_for(self.admin).put(self.url, {'enabled': True}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_encryption_needs_a_long_passphrase(self):
        c = client_for(self.admin)
        self.assertEqual(c.put(self.url, {'encrypt': True}, format='json').status_code, 400)
        self.assertEqual(c.put(self.url, {'encrypt': True, 'passphrase': 'short'}, format='json').status_code, 400)

    def test_hostile_connection_values_are_rejected(self):
        c = client_for(self.admin)
        for field, value in (
            ('server', 'fs/share'), ('server', '127.0.0.1'), ('server', '169.254.169.254'),
            ('share', '..'), ('share', 'a\\b'), ('folder', '..\\other'), ('folder', 'ok/../x'),
            ('username', 'bad\nname'),
        ):
            res = c.put(self.url, {field: value}, format='json')
            self.assertEqual(res.status_code, 400, f'{field}={value!r}')

    def test_folder_is_normalised(self):
        res = client_for(self.admin).put(self.url, {'folder': '/DRFMS//Backups/'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['folder'], 'DRFMS\\Backups')

    def test_changes_are_audited_without_secrets(self):
        from apps.audit.models import AuditLog
        client_for(self.admin).put(self.url, {'server': 'fs.psc.local', 'password': 'S3cret-pw'}, format='json')
        entry = AuditLog.objects.filter(extra__has_key='backup_settings').first()
        self.assertIsNotNone(entry)
        self.assertIn('password', entry.extra['backup_settings'])
        self.assertNotIn('S3cret-pw', str(entry.extra))

    def test_unreadable_secrets_are_flagged(self):
        cfg = BackupSettings.load()
        cfg.password_enc = 'not-a-valid-token'
        cfg.server, cfg.share, cfg.username = 'fs.psc.local', 'b', 'svc'
        cfg.save()
        res = client_for(self.admin).get(self.url)
        self.assertTrue(res.data['credentials_unreadable'])
        self.assertFalse(res.data['configured'])

    def test_test_endpoint_validates_input_before_connecting(self):
        with patch('apps.backups.smb.test') as connect:
            res = client_for(self.admin).post('/api/backups/test/', {'server': '127.0.0.1'}, format='json')
        self.assertEqual(res.status_code, 400)
        connect.assert_not_called()


class RunApiTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@t.gov.vu', UserRole.ADMINISTRATOR)
        cfg = BackupSettings.load()
        cfg.server, cfg.share, cfg.username = 'fs.psc.local', 'backups', 'svc'
        cfg.password = 'x'
        cfg.save()

    def test_cannot_start_a_second_run_while_one_is_active(self):
        c = client_for(self.admin)
        with patch('apps.backups.views.run_backup_task.delay') as delay, self.captureOnCommitCallbacks(execute=True):
            first = c.post('/api/backups/runs/')
            second = c.post('/api/backups/runs/')
        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(delay.call_count, 1)

    def test_run_requires_a_saved_connection(self):
        BackupSettings.objects.filter(pk=1).update(server='')
        self.assertEqual(client_for(self.admin).post('/api/backups/runs/').status_code, 400)

    def test_failed_run_is_recorded_and_administrators_are_told(self):
        run = BackupRun.objects.create(trigger='manual')
        with patch('apps.backups.tasks.run_backup', side_effect=RuntimeError('share is full')), \
                patch('apps.backups.tasks._notify_admins') as notify:
            tasks.run_backup_task(str(run.id))
        run.refresh_from_db()
        self.assertEqual(run.status, RunStatus.FAILED)
        self.assertEqual(run.error, 'share is full')
        notify.assert_called_once()


class FakeStorage:
    """Just enough of a Django storage for the backup walk."""

    def __init__(self, files):
        self.files = files  # name -> (bytes, modified datetime)

    def listdir(self, path):
        prefix = f'{path}/' if path else ''
        names = [n[len(prefix):] for n in self.files if n.startswith(prefix)]
        return sorted({n.split('/')[0] for n in names if '/' in n}), sorted(n for n in names if '/' not in n)

    def size(self, name):
        return len(self.files[name][0])

    def get_modified_time(self, name):
        return self.files[name][1]

    def open(self, name, mode='rb'):
        return io.BytesIO(self.files[name][0])


class FakeShare:
    """An in-memory stand-in for the smbclient calls the backup makes."""

    def __init__(self):
        self.data = {}

    def makedirs(self, path, exist_ok=False):
        pass

    def stat(self, path):
        if path not in self.data:
            raise FileNotFoundError(path)
        return type('Stat', (), {'st_size': len(self.data[path])})()

    def open_file(self, path, mode='rb'):
        share = self

        class Handle(io.BytesIO):
            def close(self):
                share.data[path] = self.getvalue()
                super().close()
        return Handle()

    def replace(self, src, dst):
        self.data[dst] = self.data.pop(src)

    def remove(self, path):
        self.data.pop(path, None)


class IncrementalCopyTests(TestCase):
    ROOT = chr(92) * 2 + 'fs' + chr(92) + 'backups' + chr(92) + 'files'

    def setUp(self):
        self.t0 = datetime(2026, 10, 1, 9, 0, 0, tzinfo=TZ)
        self.storage = FakeStorage({'records/a.pdf': (b'AAAA', self.t0), 'records/b.pdf': (b'BBBB', self.t0)})
        self.share = FakeShare()
        patches = [patch('apps.backups.service.default_storage', self.storage),
                   patch('apps.backups.service.smbclient', self.share)]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def at(self, name):
        return self.ROOT + chr(92) + 'records' + chr(92) + name

    def copy(self, encryptor=None):
        from apps.backups import service
        return service._copy_files(self.ROOT, encryptor)[:2]

    def test_first_run_copies_everything_and_the_second_skips_it(self):
        self.assertEqual(self.copy(), (2, 0))
        self.assertEqual(self.copy(), (0, 2))

    def test_a_same_size_edit_is_noticed(self):
        self.copy()
        self.storage.files['records/a.pdf'] = (b'ZZZZ', self.t0 + timedelta(minutes=5))  # same size, new content
        self.assertEqual(self.copy(), (1, 1))
        self.assertEqual(self.share.data[self.at('a.pdf')], b'ZZZZ')

    def test_a_copy_missing_from_the_share_is_sent_again(self):
        self.copy()
        del self.share.data[self.at('b.pdf')]
        self.assertEqual(self.copy(), (1, 1))

    def test_existing_copies_from_before_tracking_are_adopted_not_resent(self):
        self.share.data[self.at('a.pdf')] = b'AAAA'
        self.share.data[self.at('b.pdf')] = b'BBBB'
        self.assertEqual(self.copy(), (0, 2))
        self.storage.files['records/a.pdf'] = (b'ZZZZ', self.t0 + timedelta(minutes=5))
        self.assertEqual(self.copy(), (1, 1))

    def test_progress_is_kept_when_a_run_stops_part_way(self):
        from apps.backups import service
        from apps.backups.models import BackupFileState
        real = service._put
        calls = {'n': 0}

        def flaky(*a, **kw):
            calls['n'] += 1
            if calls['n'] == 2:
                raise OSError('share went away')
            return real(*a, **kw)
        with patch('apps.backups.service._put', side_effect=flaky):
            with self.assertRaises(OSError):
                self.copy()
        self.assertEqual(BackupFileState.objects.count(), 1)
        self.assertEqual(self.copy(), (1, 1))

    def test_switching_encryption_on_sends_encrypted_copies(self):
        self.copy()
        enc = streamcrypt.Encryptor(PASS)
        self.assertEqual(self.copy(enc), (2, 0))
        blob = self.share.data[self.at('a.pdf.enc')]
        self.assertEqual(len(blob), streamcrypt.encrypted_size(4))
        self.assertEqual(self.copy(enc), (0, 2))
