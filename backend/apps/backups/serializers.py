from rest_framework import serializers

from .models import BackupRun, BackupSettings, Frequency


class BackupSettingsSerializer(serializers.ModelSerializer):
    # Write-only: the stored password is never sent back, only whether one is set.
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
    has_password = serializers.SerializerMethodField()
    frequency = serializers.ChoiceField(Frequency.choices)
    run_hour = serializers.IntegerField(min_value=0, max_value=23)
    weekday = serializers.IntegerField(min_value=0, max_value=6)
    keep_database_copies = serializers.IntegerField(min_value=1, max_value=365)

    class Meta:
        model = BackupSettings
        fields = ['enabled', 'server', 'share', 'folder', 'domain', 'username', 'password', 'has_password',
                  'frequency', 'run_hour', 'weekday', 'keep_database_copies', 'updated_at']
        read_only_fields = ['updated_at']

    def get_has_password(self, obj):
        return bool(obj.password_enc)

    def validate(self, attrs):
        inst = self.instance
        if attrs.get('enabled', inst.enabled):
            merged = {f: attrs.get(f, getattr(inst, f)) for f in ('server', 'share', 'username')}
            has_password = bool(attrs.get('password') or inst.password_enc)
            if not all(str(v or '').strip() for v in merged.values()) or not has_password:
                raise serializers.ValidationError(
                    'Server, share, username and password are required before backups can be turned on.')
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for k, v in validated_data.items():
            setattr(instance, k, v.strip() if isinstance(v, str) else v)
        if password:  # blank keeps the saved password
            instance.password = password
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
