from django.urls import path
from . import views

urlpatterns = [
    path('', views.SharedLinkListView.as_view(), name='shared-link-list'),
    path('<str:token>/revoke/', views.SharedLinkRevokeView.as_view(), name='shared-link-revoke'),
    path('<str:token>/view/', views.SharedDocumentView.as_view(), name='shared-document-view'),
]
