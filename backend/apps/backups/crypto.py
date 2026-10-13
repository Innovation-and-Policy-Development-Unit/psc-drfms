"""Reversible encryption for the share password (it has to be sent to the share, so it cannot be hashed)."""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode() if value else ''


def decrypt(token: str) -> str:
    if not token:
        return ''
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return ''
