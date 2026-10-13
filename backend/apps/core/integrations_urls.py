from django.urls import path

from . import onedrive

urlpatterns = [
    path('onedrive/', onedrive.OneDriveSettingsView.as_view(), name='onedrive-settings'),
]
