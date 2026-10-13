"""Authenticated, streaming encryption for files written to the backup share.

Format (all integers big-endian):
    "DRFMSENC1" | salt (16) | nonce prefix (8) | chunk*
    chunk = AES-256-GCM(plaintext up to CHUNK bytes) + 16-byte tag

The key comes from the passphrase with scrypt and the salt. Each chunk's nonce is the
file's random prefix plus a 4-byte counter, and the header plus a "last chunk" flag are
authenticated, so reordering, truncating or editing a file is detected on decryption.
A run uses one salt for every file, so the (deliberately slow) key derivation happens
once per run instead of once per file.
"""
import os
import struct
from functools import lru_cache

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt

MAGIC = b'DRFMSENC1'
SALT_LEN = 16
PREFIX_LEN = 8
HEADER_LEN = len(MAGIC) + SALT_LEN + PREFIX_LEN
CHUNK = 1024 * 1024
TAG_LEN = 16

MIN_PASSPHRASE_LENGTH = 12


class DecryptionError(Exception):
    pass


@lru_cache(maxsize=8)
def _derive(passphrase: str, salt: bytes) -> bytes:
    return Scrypt(salt=salt, length=32, n=2 ** 15, r=8, p=1).derive(passphrase.encode())


def encrypted_size(plain_size: int) -> int:
    chunks = max(1, -(-plain_size // CHUNK))
    return HEADER_LEN + plain_size + chunks * TAG_LEN


def _nonce(prefix: bytes, counter: int) -> bytes:
    return prefix + struct.pack('>I', counter)


def _read_full(fh, n):
    buf = b''
    while len(buf) < n:
        part = fh.read(n - len(buf))
        if not part:
            break
        buf += part
    return buf


class Encryptor:
    """Encrypts many files under one passphrase with a single key derivation."""

    def __init__(self, passphrase: str):
        self.salt = os.urandom(SALT_LEN)
        self._aes = AESGCM(_derive(passphrase, self.salt))

    def encrypt(self, src, dst) -> None:
        header = MAGIC + self.salt + os.urandom(PREFIX_LEN)
        prefix = header[-PREFIX_LEN:]
        dst.write(header)
        counter = 0
        current = _read_full(src, CHUNK)
        while True:
            upcoming = _read_full(src, CHUNK) if len(current) == CHUNK else b''
            last = not upcoming
            dst.write(self._aes.encrypt(_nonce(prefix, counter), current, header + (b'\x01' if last else b'\x00')))
            if last:
                return
            counter += 1
            current = upcoming


def decrypt(passphrase: str, src, dst) -> None:
    header = _read_full(src, HEADER_LEN)
    if len(header) != HEADER_LEN or not header.startswith(MAGIC):
        raise DecryptionError('This is not a DRFMS encrypted backup file.')
    salt = header[len(MAGIC):len(MAGIC) + SALT_LEN]
    prefix = header[-PREFIX_LEN:]
    aes = AESGCM(_derive(passphrase, salt))
    counter = 0
    current = _read_full(src, CHUNK + TAG_LEN)
    if not current:
        raise DecryptionError('The file is truncated.')
    try:
        while True:
            upcoming = _read_full(src, CHUNK + TAG_LEN) if len(current) == CHUNK + TAG_LEN else b''
            last = not upcoming
            dst.write(aes.decrypt(_nonce(prefix, counter), current, header + (b'\x01' if last else b'\x00')))
            if last:
                return
            counter += 1
            current = upcoming
    except InvalidTag as exc:
        raise DecryptionError('Wrong passphrase, or the file is damaged or incomplete.') from exc
