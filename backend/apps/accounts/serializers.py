from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import User, Department, UserRole

UserModel = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'parent']


class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 'full_name',
            'role', 'department', 'department_name', 'job_title', 'phone',
            'avatar', 'is_active', 'is_2fa_required', 'preferred_language',
            'date_joined', 'last_active',
        ]
        read_only_fields = ['date_joined', 'last_active']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=10)

    class Meta:
        model = User
        fields = [
            'email', 'username', 'first_name', 'last_name', 'password',
            'role', 'department', 'job_title', 'phone', 'is_2fa_required',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'job_title', 'phone',
            'preferred_language', 'avatar',
        ]


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=10)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value


class DelegationSerializer(serializers.Serializer):
    delegate_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True))
    delegate_from = serializers.DateTimeField(required=False, allow_null=True)
    delegate_until = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        request = self.context.get('request')
        delegate_to = attrs.get('delegate_to')
        delegate_from = attrs.get('delegate_from')
        delegate_until = attrs.get('delegate_until')

        if request and delegate_to == request.user:
            raise serializers.ValidationError({'delegate_to': 'You cannot delegate to yourself.'})

        if delegate_from and delegate_until and delegate_until < delegate_from:
            raise serializers.ValidationError({
                'delegate_until': 'Delegation end must be after the start time.'
            })

        return attrs


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = UserModel.USERNAME_FIELD

    def validate(self, attrs):
        # Accept legacy "username" key (e.g. Django admin habit) as email
        if self.username_field not in attrs and 'username' in attrs:
            attrs[self.username_field] = attrs.pop('username')

        data = super().validate(attrs)
        user = self.user

        if not user.is_active:
            raise serializers.ValidationError('This account has been deactivated.')

        if user.is_account_locked:
            raise serializers.ValidationError('This account is temporarily locked. Try again later.')

        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        token['full_name'] = user.get_full_name()
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        # 2FA verification lives in the token, NOT in the database.
        # At login time the claim is False when 2FA is required.
        # TwoFactorVerifyView issues a replacement token pair with this set to True.
        from django_otp.plugins.otp_totp.models import TOTPDevice
        has_confirmed_totp = TOTPDevice.objects.filter(user=user, confirmed=True).exists()
        token['2fa_verified'] = not (user.is_2fa_required and has_confirmed_totp)
        return token
