"""Decrypt a file from an encrypted DRFMS backup.

    python manage.py decrypt_backup drfms-20261013-010000.dump.enc drfms.dump

The passphrase is read from the DRFMS_BACKUP_PASSPHRASE environment variable, or prompted for.
"""
import getpass
import os

from django.core.management.base import BaseCommand, CommandError

from apps.backups import streamcrypt


class Command(BaseCommand):
    help = 'Decrypt a file from an encrypted backup.'

    def add_arguments(self, parser):
        parser.add_argument('source')
        parser.add_argument('destination')

    def handle(self, *args, **opts):
        passphrase = os.environ.get('DRFMS_BACKUP_PASSPHRASE') or getpass.getpass('Backup passphrase: ')
        if os.path.exists(opts['destination']):
            raise CommandError(f"{opts['destination']} already exists; choose a new name.")
        try:
            with open(opts['source'], 'rb') as src, open(opts['destination'], 'wb') as dst:
                streamcrypt.decrypt(passphrase, src, dst)
        except streamcrypt.DecryptionError as exc:
            if os.path.exists(opts['destination']):
                os.remove(opts['destination'])
            raise CommandError(str(exc))
        self.stdout.write(self.style.SUCCESS(f"Decrypted to {opts['destination']}"))
