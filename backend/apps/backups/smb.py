"""Thin wrapper over smbprotocol so the rest of the app never touches it directly."""
import uuid

import smbclient

PROBE_TEXT = 'drfms backup connection test'


class ShareError(Exception):
    """Raised with a message safe to show an administrator."""


def root_path(cfg) -> str:
    parts = ['\\\\' + cfg.server.strip(), cfg.share.strip().strip('\\/')]
    folder = (cfg.folder or '').strip().strip('\\/').replace('/', '\\')
    if folder:
        parts.append(folder)
    return '\\'.join(parts)


def connect(cfg, password=None):
    user = cfg.username.strip()
    if cfg.domain.strip():
        user = cfg.domain.strip() + '\\' + user
    smbclient.reset_connection_cache()
    try:
        smbclient.register_session(
            cfg.server.strip(), username=user,
            password=cfg.password if password is None else password,
            connection_timeout=15,
        )
    except Exception as exc:  # smbprotocol raises many types
        raise ShareError(f'Could not connect to {cfg.server}: {exc}') from exc


def test(cfg, password=None) -> str:
    """Connect, write a small file, read it back and delete it. Returns the folder used."""
    connect(cfg, password)
    root = root_path(cfg)
    probe = f'{root}\\.drfms-test-{uuid.uuid4().hex[:8]}'
    try:
        smbclient.makedirs(root, exist_ok=True)
        with smbclient.open_file(probe, mode='w') as fh:
            fh.write(PROBE_TEXT)
        with smbclient.open_file(probe, mode='r') as fh:
            if fh.read() != PROBE_TEXT:
                raise ShareError('The share returned unexpected data when reading the test file back.')
        smbclient.remove(probe)
    except ShareError:
        raise
    except Exception as exc:
        raise ShareError(f'Connected, but could not write to {root}: {exc}') from exc
    return root
