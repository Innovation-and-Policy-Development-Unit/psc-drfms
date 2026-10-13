from django.urls import path

from . import views

urlpatterns = [
    path('settings/', views.BackupSettingsView.as_view(), name='backup-settings'),
    path('test/', views.BackupTestView.as_view(), name='backup-test'),
    path('runs/', views.BackupRunView.as_view(), name='backup-runs'),
]
