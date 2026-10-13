"""Checks on what an administrator may point the backup at."""
import ipaddress
import re
import socket

from rest_framework import serializers

HOST = re.compile(r'^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$')
NAME_CHARS = re.compile(r'^[^\\/:*?"<>|\x00-\x1f]+$')
ACCOUNT = re.compile(r'^[^\x00-\x1f\\/:*?"<>|]{1,128}$')


def check_host(value):
    """A plain host name or IP. Loopback and link-local addresses are refused so the test
    button cannot be used to probe the DRFMS server itself or cloud metadata services."""
    value = value.strip()
    if not value:
        return value
    if not HOST.match(value):
        raise serializers.ValidationError('Enter just the server name or IP address, for example fileserver.psc.local.')
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(value, 445, proto=socket.IPPROTO_TCP)}
    except socket.gaierror:
        return value  # not resolvable from here; the connection test will say so
    for addr in addresses:
        ip = ipaddress.ip_address(addr.split('%')[0])
        if ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_multicast:
            raise serializers.ValidationError('That address is not a file server (loopback or link-local).')
    return value


def check_share(value):
    value = value.strip().strip('\\/')
    if value and (not NAME_CHARS.match(value) or value in ('.', '..') or len(value) > 80):
        raise serializers.ValidationError('Enter just the share name, with no slashes or special characters.')
    return value


def check_folder(value):
    parts = [p for p in value.strip().replace('\\', '/').split('/') if p]
    for p in parts:
        if p in ('.', '..') or not NAME_CHARS.match(p) or p.endswith(('.', ' ')):
            raise serializers.ValidationError('Folder names cannot contain "..", slashes or special characters.')
    return '\\'.join(parts)


def check_account(value):
    value = value.strip()
    if value and not ACCOUNT.match(value):
        raise serializers.ValidationError('That name contains characters that are not allowed.')
    return value
