from django.urls import path
from . import views

urlpatterns = [
    path('config/<uuid:record_id>/<int:version_id>/', views.OnlyOfficeConfigView.as_view(), name='oo-config'),
    path('document/<uuid:record_id>/<int:version_id>/<str:token>/', views.onlyoffice_document, name='oo-document'),
    path('callback/<uuid:record_id>/<int:version_id>/<str:token>/', views.onlyoffice_callback, name='oo-callback'),
]
