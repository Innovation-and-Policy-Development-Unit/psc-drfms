from django.urls import path
from . import views

urlpatterns = [
    path('logs/', views.AuditLogListView.as_view(), name='audit-log-list'),
    path('custody/<uuid:record_id>/', views.CustodyChainView.as_view(), name='custody-chain'),
]
