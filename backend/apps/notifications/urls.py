from django.urls import path
from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification-list'),
    path('activity/', views.activity_feed, name='notification-activity'),
    path('mark-all-read/', views.mark_all_read, name='notification-mark-all-read'),
    path('<uuid:pk>/read/', views.mark_read, name='notification-mark-read'),
]
