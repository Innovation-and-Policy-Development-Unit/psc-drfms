from rest_framework.permissions import BasePermission
from .models import UserRole


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
