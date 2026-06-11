from django.urls import path
from . import views

urlpatterns = [
    path('api-keys/', views.ApiKeyListView.as_view(), name='api-key-list'),
    path('api-keys/<uuid:pk>/revoke/', views.ApiKeyRevokeView.as_view(), name='api-key-revoke'),
    path('webhooks/', views.WebhookListView.as_view(), name='webhook-list'),
    path('webhooks/<uuid:pk>/', views.WebhookDetailView.as_view(), name='webhook-detail'),
]
