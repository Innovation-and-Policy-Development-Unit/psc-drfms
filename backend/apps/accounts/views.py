from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice
import pyotp, qrcode, io, base64

from .models import Department, UserRole
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    DepartmentSerializer, PasswordChangeSerializer, DelegationSerializer,
    CustomTokenObtainPairSerializer,
)
from .permissions import IsAdministrator, IsRecordsOfficerOrAbove

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(email=request.data.get('email'))
            user.last_active = timezone.now()
            user.last_login_ip = self._get_client_ip(request)
            user.failed_login_count = 0
            user.save(update_fields=['last_active', 'last_login_ip', 'failed_login_count'])

            response.data['requires_2fa'] = (
                user.is_2fa_required and
                TOTPDevice.objects.filter(user=user, confirmed=True).exists()
            )
            response.data['role'] = user.role
        return response

    def _get_client_ip(self, request):
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.select_related('department').all()
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get('role')
        dept = self.request.query_params.get('department')
        is_active = self.request.query_params.get('is_active')
        if role:
            qs = qs.filter(role=role)
        if dept:
            qs = qs.filter(department_id=dept)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.select_related('department').all()
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]
    serializer_class = UserSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return UserUpdateSerializer
        return UserSerializer


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'Password changed successfully.'})


class TwoFactorSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        device, created = TOTPDevice.objects.get_or_create(
            user=request.user, defaults={'name': 'default', 'confirmed': False}
        )
        issuer = 'PSC-DRFMS'
        label = f"{issuer}:{request.user.email}"
        totp = pyotp.TOTP(device.key)
        uri = totp.provisioning_uri(name=request.user.email, issuer_name=issuer)

        img = qrcode.make(uri)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

        return Response({'qr_code': f"data:image/png;base64,{qr_b64}", 'secret': device.key})

    def post(self, request):
        otp = request.data.get('otp', '')
        try:
            device = TOTPDevice.objects.get(user=request.user, confirmed=False)
        except TOTPDevice.DoesNotExist:
            return Response({'detail': '2FA already configured.'}, status=400)

        totp = pyotp.TOTP(device.key)
        if totp.verify(otp):
            device.confirmed = True
            device.save()
            return Response({'detail': '2FA enabled successfully.'})
        return Response({'detail': 'Invalid OTP.'}, status=400)


class TwoFactorVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        otp = request.data.get('otp', '')
        try:
            device = TOTPDevice.objects.get(user=request.user, confirmed=True)
        except TOTPDevice.DoesNotExist:
            return Response({'detail': 'No 2FA device found.'}, status=400)

        totp = pyotp.TOTP(device.key)
        if totp.verify(otp, valid_window=1):
            request.user.is_2fa_verified = True
            request.user.save(update_fields=['is_2fa_verified'])
            return Response({'detail': '2FA verified.'})
        return Response({'detail': 'Invalid OTP.'}, status=400)


class DelegationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'delegate_to': user.delegate_to_id,
            'delegate_from': user.delegate_from,
            'delegate_until': user.delegate_until,
            'has_active_delegation': user.has_active_delegation,
        })

    def post(self, request):
        serializer = DelegationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user
        user.delegate_to = data['delegate_to']
        user.delegate_from = data.get('delegate_from')
        user.delegate_until = data.get('delegate_until')
        user.save(update_fields=['delegate_to', 'delegate_from', 'delegate_until'])
        return Response({'detail': 'Delegation set.'})

    def delete(self, request):
        user = request.user
        user.delegate_to = None
        user.delegate_from = None
        user.delegate_until = None
        user.save(update_fields=['delegate_to', 'delegate_from', 'delegate_until'])
        return Response({'detail': 'Delegation removed.'})


class DepartmentListView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsAdministrator()]
        return [permissions.IsAuthenticated()]


class UserSuspendView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def post(self, request, pk):
        user = User.objects.get(pk=pk)
        user.is_active = False
        user.save(update_fields=['is_active'])
        # Invalidate all tokens
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
        return Response({'detail': f'User {user.email} suspended.'})


class UserReactivateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def post(self, request, pk):
        user = User.objects.get(pk=pk)
        user.is_active = True
        user.failed_login_count = 0
        user.account_locked_until = None
        user.save(update_fields=['is_active', 'failed_login_count', 'account_locked_until'])
        return Response({'detail': f'User {user.email} reactivated.'})
