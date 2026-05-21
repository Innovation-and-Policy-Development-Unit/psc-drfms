from django.urls import path
from . import views

urlpatterns = [
    path('', views.RecordListCreateView.as_view(), name='record-list'),
    path('<uuid:pk>/', views.RecordDetailView.as_view(), name='record-detail'),
    path('<uuid:pk>/versions/', views.RecordVersionListView.as_view(), name='record-versions'),
    path('<uuid:pk>/versions/upload/', views.RecordVersionUploadView.as_view(), name='record-version-upload'),
    path('<uuid:pk>/versions/diff/', views.RecordVersionDiffView.as_view(), name='record-version-diff'),
    path('<uuid:pk>/qr-code/', views.RecordQRCodeView.as_view(), name='record-qr-code'),
    path('<uuid:pk>/permissions/', views.DocumentPermissionView.as_view(), name='record-permissions'),
    path('series/', views.RecordSeriesListView.as_view(), name='record-series-list'),
]
