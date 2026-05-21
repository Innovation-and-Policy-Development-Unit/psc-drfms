from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'parent']
    search_fields = ['name', 'code']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'get_full_name', 'role', 'department', 'is_active', 'is_2fa_required']
    list_filter = ['role', 'is_active', 'is_2fa_required', 'department']
    search_fields = ['email', 'first_name', 'last_name', 'username']
    ordering = ['email']
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal', {'fields': ('first_name', 'last_name', 'job_title', 'phone', 'avatar')}),
        ('Access', {'fields': ('role', 'department', 'is_active', 'is_staff', 'is_superuser')}),
        ('Security', {'fields': ('is_2fa_required', 'ip_whitelist', 'preferred_language')}),
        ('Delegation', {'fields': ('delegate_to', 'delegate_from', 'delegate_until')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'first_name', 'last_name', 'password1', 'password2', 'role'),
        }),
    )
