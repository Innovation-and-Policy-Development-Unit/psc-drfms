from django.urls import path
from . import views

urlpatterns = [
    path('', views.CorrespondenceListView.as_view(), name='correspondence-list'),
    path('<uuid:pk>/', views.CorrespondenceDetailView.as_view(), name='correspondence-detail'),
]
