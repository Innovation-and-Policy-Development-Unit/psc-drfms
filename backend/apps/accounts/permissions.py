from rest_framework.permissions import BasePermission
from .models import UserRole


class IsTwoFactorVerified(BasePermission):
    """
    Allow access only when the request's JWT carries '2fa_verified': True,
    OR when the user has not enabled 2FA at all.
    Attach this permission to any view that must be behind the 2FA gate.
    """
    message = 'Two-factor authentication is required to access this resource.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # If 2FA is not required for this user, let them through
        if not request.user.is_2fa_required:
            return True
        # Check the JWT claim (request.auth is the validated AccessToken object)
        token = getattr(request, 'auth', None)
        if token is None:
            return False
        # simplejwt AccessToken supports dict-style access to payload claims
        try:
            return bool(token.get('2fa_verified', False))
        except Exception:
            return False


class IsAdministrator(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == UserRole.ADMINISTRATOR


class IsDirectorOrAbove(BasePermission):
    ALLOWED = {UserRole.DIRECTOR, UserRole.COMMISSIONER, UserRole.ADMINISTRATOR}

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.ALLOWED


class IsRecordsOfficerOrAbove(BasePermission):
    ALLOWED = {
        UserRole.RECORDS_OFFICER, UserRole.DIRECTOR,
        UserRole.COMMISSIONER, UserRole.ADMINISTRATOR,
    }

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.ALLOWED


class IsReviewerOrAbove(BasePermission):
    ALLOWED = {
        UserRole.REVIEWER, UserRole.RECORDS_OFFICER, UserRole.DIRECTOR,
        UserRole.COMMISSIONER, UserRole.ADMINISTRATOR,
    }

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in self.ALLOWED


class IsNotReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role != UserRole.READ_ONLY
