from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    RECORDS_OFFICER = 'records_officer', 'Records Officer'
    REVIEWER = 'reviewer', 'Reviewer'
    DIRECTOR = 'director', 'Director'
    COMMISSIONER = 'commissioner', 'Commissioner'
    ADMINISTRATOR = 'administrator', 'Administrator'
    READ_ONLY = 'read_only', 'Read Only'


class Department(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMINISTRATOR)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    role = models.CharField(max_length=30, choices=UserRole.choices, default=UserRole.READ_ONLY)
    department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    job_title = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_2fa_required = models.BooleanField(default=False)
    # DEPRECATED — do NOT use for authentication decisions.
    # 2FA verification state is now carried as a '2fa_verified' claim in the JWT.
    # This field is kept for schema compatibility but is no longer written by auth views.
    is_2fa_verified = models.BooleanField(default=False)

    # Delegation
    delegate_to = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='delegated_from'
    )
    delegate_from = models.DateTimeField(null=True, blank=True)
    delegate_until = models.DateTimeField(null=True, blank=True)

    # SSO
    saml_name_id = models.CharField(max_length=255, blank=True, unique=True, null=True)

    # Session control
    ip_whitelist = models.JSONField(default=list, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    failed_login_count = models.PositiveSmallIntegerField(default=0)
    account_locked_until = models.DateTimeField(null=True, blank=True)

    preferred_language = models.CharField(max_length=10, default='en', choices=[('en', 'English'), ('fr', 'French')])

    date_joined = models.DateTimeField(default=timezone.now)
    last_active = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    objects = UserManager()

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_account_locked(self):
        if self.account_locked_until and self.account_locked_until > timezone.now():
            return True
        return False

    @property
    def has_active_delegation(self):
        if not self.delegate_to:
            return False
        now = timezone.now()
        from_ok = self.delegate_from is None or self.delegate_from <= now
        until_ok = self.delegate_until is None or self.delegate_until >= now
        return from_ok and until_ok

    def get_effective_role(self):
        """Return effective role considering delegation."""
        if self.has_active_delegation and self.delegate_to:
            return self.delegate_to.role
        return self.role
