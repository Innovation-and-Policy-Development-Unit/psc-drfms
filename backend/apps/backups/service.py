"""The backup itself: a PostgreSQL dump plus a copy of every stored file, onto the SMB share.

Layout on the share (under the configured folder):
    database/drfms-YYYYMMDD-HHMMSS.dump   one per run, oldest pruned past ``keep_database_copies``
    files/<object key>                    mirror of the document store (local disk or MinIO, whichever is configured); only new or changed files are sent

Nothing is ever deleted from ``files/`` by a run, so a record disposed of in DRFMS stays in the
backup until an administrator clears it on the share.
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

from . import smb

logger = logging.getLogger(__name__)

CHUNK = 4 * 1024 * 1024
_BAD_CHARS = re.compile(r'[<>:"|?*\x00-\x1f]')


def _share_name(key):
    """Map an object key to a safe relative Windows path, or None to skip it."""
    if not key or key.endswith('/'):
        return None
    parts = [p for p in key.split('/') if p not in ('', '.')]
    if not parts or any(p == '..' for p in parts):
        return None
    return '\\'.join(_BAD_CHARS.sub('_', p).rstrip(' .') or '_' for p in parts)


def _dump_database(dest_dir):
    db = settings.DATABASES['default']
    name = f'drfms-{timezone.now():%Y%m%d-%H%M%S}.dump'
    env = {**os.environ, 'PGPASSWORD': str(db.get('PASSWORD') or '')}
    with tempfile.TemporaryDirectory() as tmp:
        local = os.path.join(tmp, name)
        cmd = ['pg_dump', '-Fc', '-h', str(db.get('HOST') or 'db'), '-p', str(db.get('PORT') or 5432),
               '-U', str(db['USER']), '-d', str(db['NAME']), '-f', local]
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=1500)
        if proc.returncode != 0:
            raise RuntimeError('Database dump failed: ' + proc.stderr.strip()[:500])
        size = os.path.getsize(local)
        with open(local, 'rb') as src, smbclient.open_file(f'{dest_dir}\\{name}', mode='wb') as out:
            while chunk := src.read(CHUNK):
                out.write(chunk)
    return name, size


def _prune_database_copies(dest_dir, keep):
    dumps = sorted(n for n in smbclient.listdir(dest_dir) if n.startswith('drfms-') and n.endswith('.dump'))
    if keep > 0:
        for old in dumps[:-keep]:
            smbclient.remove(f'{dest_dir}\\{old}')


def _walk(storage, path=""):
    """Yield the storage name of every stored file, whatever backend holds them."""
    dirs, files = storage.listdir(path)
    for name in files:
        yield f"{path}/{name}" if path else name
    for d in dirs:
        yield from _walk(storage, f"{path}/{d}" if path else d)


def _copy_files(dest_dir):
    storage = default_storage
    copied = skipped = total_bytes = 0
    made_dirs = set()
    for key in _walk(storage):
        rel = _share_name(key)
        if rel is None:
            continue
        size = storage.size(key)
        dest = dest_dir + "\\" + rel
        try:
            if smbclient.stat(dest).st_size == size:
                skipped += 1
                continue
        except OSError:
            pass  # not on the share yet
        parent = dest.rsplit("\\", 1)[0]
        if parent not in made_dirs:
            smbclient.makedirs(parent, exist_ok=True)
            made_dirs.add(parent)
        with storage.open(key, "rb") as src, smbclient.open_file(dest, mode="wb") as out:
            while chunk := src.read(CHUNK):
                out.write(chunk)
        copied += 1
        total_bytes += size
    return copied, skipped, total_bytes


def run_backup(run, cfg):
    """Perform one backup, recording progress on ``run``. Raises on failure."""
    smb.connect(cfg)
    root = smb.root_path(cfg)
    db_dir, files_dir = f'{root}\\database', f'{root}\\files'
    smbclient.makedirs(db_dir, exist_ok=True)
    smbclient.makedirs(files_dir, exist_ok=True)

    run.database_file, run.database_bytes = _dump_database(db_dir)
    run.save(update_fields=['database_file', 'database_bytes'])
    _prune_database_copies(db_dir, cfg.keep_database_copies)

    run.files_copied, run.files_skipped, run.files_bytes = _copy_files(files_dir)
