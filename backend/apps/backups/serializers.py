from rest_framework import serializers

from . import streamcrypt, validators
from .models import BackupRun, BackupSettings, Frequency


class ConnectionValidationMixin:
    """Field checks for the where-and-who of the share, shared by saving settings and the connection test."""

    def validate_server(self, value):
        return validators.check_host(value)

    def validate_share(self, value):
        return validators.check_share(value)

    def validate_folder(self, value):
        return validators.check_folder(value)

    def validate_domain(self, value):
        return validators.check_account(value)

    def validate_username(self, value):
        return validators.check_account(value)


class ConnectionSerializer(ConnectionValidationMixin, serializers.Serializer):
    server = serializers.CharField(max_length=255, allow_blank=True, required=False)
    share = serializers.CharField(max_length=80, allow_blank=True, required=False)
    folder = serializers.CharField(max_length=255, allow_blank=True, required=False)
    domain = serializers.CharField(max_length=128, allow_blank=True, required=False)
    username = serializers.CharField(max_length=128, allow_blank=True, required=False)


class BackupSettingsSerializer(ConnectionValidationMixin, serializers.ModelSerializer):
    # Write-only: stored secrets are never sent back, only whether they are set.
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
    passphrase = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
    has_password = serializers.SerializerMethodField()
    has_passphrase = serializers.SerializerMethodField()
    frequency = serializers.ChoiceField(Frequency.choices)
    run_hour = serializers.IntegerField(min_value=0, max_value=23)
    weekday = serializers.IntegerField(min_value=0, max_value=6)
    keep_database_copies = serializers.IntegerField(min_value=1, max_value=365)

    class Meta:
        model = BackupSettings
        fields = ['enabled', 'server', 'share', 'folder', 'domain', 'username', 'password', 'has_password',
                  'frequency', 'run_hour', 'weekday', 'keep_database_copies',
                  'encrypt', 'passphrase', 'has_passphrase', 'updated_at']
        read_only_fields = ['updated_at']

    def get_has_password(self, obj):
        return bool(obj.password_enc)

    def get_has_passphrase(self, obj):
        return bool(obj.passphrase_enc)

    def validate_passphrase(self, value):
        if value and len(value) < streamcrypt.MIN_PASSPHRASE_LENGTH:
            raise serializers.ValidationError(
                f'Use at least {streamcrypt.MIN_PASSPHRASE_LENGTH} characters for the encryption passphrase.')
        return value

    def validate(self, attrs):
        inst = self.instance
        if attrs.get('enabled', inst.enabled):
            merged = {f: attrs.get(f, getattr(inst, f)) for f in ('server', 'share', 'username')}
            if not all(str(v or '').strip() for v in merged.values()) or not (attrs.get('password') or inst.password_enc):
                raise serializers.ValidationError(
                    'Server, share, username and password are required before backups can be turned on.')
        if attrs.get('encrypt', inst.encrypt) and not (attrs.get('passphrase') or inst.passphrase_enc):
            raise serializers.ValidationError('Enter an encryption passphrase before turning encryption on.')
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        passphrase = validated_data.pop('passphrase', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:  # blank keeps the saved value
            instance.password = password
        if passphrase:
            instance.passphrase = passphrase
        instance.save()
        return instance


class BackupRunSerializer(serializers.ModelSerializer):
    triggered_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BackupRun
        fields = ['id', 'status', 'trigger', 'triggered_by_name', 'started_at', 'finished_at', 'database_file',
                  'database_bytes', 'files_copied', 'files_skipped', 'files_bytes', 'error']

    def get_triggered_by_name(self, obj):
        user = obj.triggered_by
        return (user.get_full_name() or user.email) if user else ''
