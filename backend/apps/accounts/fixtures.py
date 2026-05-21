import os
from django.contrib.auth import get_user_model

User = get_user_model()


def create_superuser():
    email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@psc.gov.vu')
    password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'Admin@123!')
    username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
    if not User.objects.filter(email=email).exists():
        User.objects.create_superuser(
            email=email,
            password=password,
            username=username,
            first_name='System',
            last_name='Administrator',
        )
        print(f'Superuser created: {email}')
    else:
        print(f'Superuser already exists: {email}')
