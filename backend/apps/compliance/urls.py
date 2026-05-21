from django.urls import path
from . import views

urlpatterns = [
    path('legal-holds/', views.LegalHoldListView.as_view(), name='legal-hold-list'),
    path('legal-holds/<uuid:pk>/', views.LegalHoldDetailView.as_view(), name='legal-hold-detail'),
    path('legal-holds/<uuid:pk>/lift/', views.LegalHoldLiftView.as_view(), name='legal-hold-lift'),
    path('destruction/', views.DestructionCertificateListView.as_view(), name='destruction-list'),
    path('destruction/<uuid:pk>/', views.DestructionCertificateDetailView.as_view(), name='destruction-detail'),
    path('destruction/<uuid:pk>/approve/', views.DestructionApproveView.as_view(), name='destruction-approve'),
    path('retention/', views.RetentionScheduleListView.as_view(), name='retention-list'),
    path('overdue/', views.OverdueRecordsView.as_view(), name='overdue-records'),
]
