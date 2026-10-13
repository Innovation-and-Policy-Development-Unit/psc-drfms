"""The backup itself: a PostgreSQL dump plus a copy of every stored file, onto the SMB share.

Layout on the share (under the configured folder):
    database/drfms-YYYYMMDD-HHMMSS.dump[.enc]   one per run, oldest pruned past ``keep_database_copies``
    files/<storage name>[.enc]                  mirror of the document store; only new or changed files are sent

Safety rules:
  * Every file is written under a temporary ``.part`` name, its size is checked, and only then
    is it renamed into place - an interrupted run can never leave something that looks complete.
  * The database dump is checked with ``pg_restore --list`` before it is sent.
  * Nothing is deleted from ``files/`` by a run, so a record disposed of in DRFMS stays in the
    backup until an administrator clears it on the share.
  * With encryption on, everything is encrypted before it leaves DRFMS (see ``streamcrypt``).
"""
import logging
import os
import re
import subprocess
import tempfile

import smbclient
from django.conf import settings
from django.core.files.storage import default_storage
from django.utils import timezone

from . import smb, streamcrypt

logger = logging.getLogger(__name__)

CHUNK = 4 * 1024 * 1024
PART = '.part'
ENC = '.enc'
_BAD_CHARS = re.compile(r'[<>:"|?*\x00-\x1f]')


def _share_name(key):
    """Map a storage name to a safe relative Windows path, or None to skip it."""
    if not key or key.endswith('/'):
        return None
    parts = [p for p in key.split('/') if p not in ('', '.')]
    if not parts or any(p == '..' for p in parts):
        return None
    return '\\'.join(_BAD_CHARS.sub('_', p).rstrip(' .') or '_' for p in parts)


def _put(dest, src, plain_size, encryptor):
    """Write ``src`` to ``dest`` atomically, checking the size that landed on the share."""
    tmp = dest + PART
    try:
        with smbclient.open_file(tmp, mode='wb') as out:
            if encryptor:
                encryptor.encrypt(src, out)
            else:
                while chunk := src.read(CHUNK):
                    out.write(chunk)
        expected = streamcrypt.encrypted_size(plain_size) if encryptor else plain_size
        landed = smbclient.stat(tmp).st_size
        if landed != expected:
            raise RuntimeError(f'Size check failed for {dest}: expected {expected} bytes, share has {landed}.')
        smbclient.replace(tmp, dest)
    except BaseException:
        try:
            smbclient.remove(tmp)
        except OSError:
            pass
        raise


def _dump_database(dest_dir, encryptor):
    db = settings.DATABASES['default']
    name = f'drfms-{timezone.now():%Y%m%d-%H%M%S}.dump'
    env = {**os.environ, 'PGPASSWORD': str(db.get('PASSWORD') or '')}
    with tempfile.TemporaryDirectory() as tmp:
        local = os.path.join(tmp, name)
        cmd = ['pg_dump', '-Fc', '-h', str(db.get('HOST') or 'db'), '-p', str(db.get('PORT') or 5432),
               '-U', str(db['USER']), '-d', str(db['NAME']), '-f', local]
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=settings.BACKUP_DUMP_TIMEOUT)
        if proc.returncode != 0:
            raise RuntimeError('Database dump failed: ' + proc.stderr.strip()[:500])
        check = subprocess.run(['pg_restore', '--list', local], capture_output=True, text=True, timeout=300)
        if check.returncode != 0:
            raise RuntimeError('The database dump could not be read back: ' + check.stderr.strip()[:300])
        size = os.path.getsize(local)
        stored = name + (ENC if encryptor else '')
        with open(local, 'rb') as src:
            _put(f'{dest_dir}\\{stored}', src, size, encryptor)
    return stored, size


def _prune_database_copies(dest_dir, keep):
    dumps = sorted(n for n in smbclient.listdir(dest_dir)
                   if n.startswith('drfms-') and n.endswith(('.dump', '.dump' + ENC)))
    if keep > 0:
        for old in dumps[:-keep]:
            smbclient.remove(f'{dest_dir}\\{old}')


def _remove_leftover_parts(directory):
    for name in smbclient.listdir(directory):
        if name.endswith(PART):
            try:
                smbclient.remove(f'{directory}\\{name}')
            except OSError:
                pass


def _walk(storage, path=''):
    """Yield the storage name of every stored file, whatever backend holds them."""
    dirs, files = storage.listdir(path)
    for name in files:
        yield f'{path}/{name}' if path else name
    for d in dirs:
        yield from _walk(storage, f'{path}/{d}' if path else d)


def _copy_files(dest_dir, encryptor):
    storage = default_storage
    copied = skipped = total_bytes = 0
    made_dirs = set()
    for key in _walk(storage):
        rel = _share_name(key)
        if rel is None:
            continue
        if encryptor:
            rel += ENC
        size = storage.size(key)
        expected = streamcrypt.encrypted_size(size) if encryptor else size
        dest = dest_dir + '\\' + rel
        try:
            if smbclient.stat(dest).st_size == expected:
                skipped += 1
                continue
        except OSError:
            pass  # not on the share yet
        parent = dest.rsplit('\\', 1)[0]
        if parent not in made_dirs:
            smbclient.makedirs(parent, exist_ok=True)
            made_dirs.add(parent)
        with storage.open(key, 'rb') as src:
            _put(dest, src, size, encryptor)
        copied += 1
        total_bytes += size
    return copied, skipped, total_bytes


def run_backup(run, cfg):
    """Perform one backup, recording progress on ``run``. Raises on failure."""
    smb.connect(cfg)
    encryptor = streamcrypt.Encryptor(cfg.passphrase) if cfg.encrypt else None
    root = smb.root_path(cfg)
    db_dir, files_dir = f'{root}\\database', f'{root}\\files'
    smbclient.makedirs(db_dir, exist_ok=True)
    smbclient.makedirs(files_dir, exist_ok=True)
    _remove_leftover_parts(db_dir)

    run.database_file, run.database_bytes = _dump_database(db_dir, encryptor)
    run.save(update_fields=['database_file', 'database_bytes'])
    _prune_database_copies(db_dir, cfg.keep_database_copies)

    run.files_copied, run.files_skipped, run.files_bytes = _copy_files(files_dir, encryptor)
