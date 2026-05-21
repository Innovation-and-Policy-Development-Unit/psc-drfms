import os
from django.contrib.auth import get_user_model
from .models import UserRole

User = get_user_model()


def create_superuser():
    email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@psc.gov.vu')
    password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'Admin@123!')
    username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')

    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'username': username,
            'first_name': 'System',
            'last_name': 'Administrator',
            'role': UserRole.ADMINISTRATOR,
            'is_2fa_required': False,
        },
    )

    if created:
        user.set_password(password)
    else:
        if not user.check_password(password):
            user.set_password(password)

    user.username = username
    user.first_name = user.first_name or 'System'
    user.last_name = user.last_name or 'Administrator'
    user.role = UserRole.ADMINISTRATOR
    user.is_active = True
    user.is_staff = True
    user.is_superuser = True
    user.is_2fa_required = False
    user.is_2fa_verified = False
    user.save()

    print(f'Superuser ready for frontend login: {email}')
