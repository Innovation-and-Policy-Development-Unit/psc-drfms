from django.urls import path
from . import views

urlpatterns = [
    path('', views.RecordListCreateView.as_view(), name='record-list'),
    path('<uuid:pk>/', views.RecordDetailView.as_view(), name='record-detail'),
    path('<uuid:pk>/star/', views.RecordStarView.as_view(), name='record-star'),
    path('<uuid:pk>/versions/', views.RecordVersionListView.as_view(), name='record-versions'),
    path('<uuid:pk>/versions/upload/', views.RecordVersionUploadView.as_view(), name='record-version-upload'),
    path('<uuid:pk>/versions/diff/', views.RecordVersionDiffView.as_view(), name='record-version-diff'),
    path('<uuid:pk>/versions/<uuid:version_id>/download/', views.RecordVersionDownloadView.as_view(), name='record-version-download'),
    path('<uuid:pk>/versions/<uuid:version_id>/preview-url/', views.RecordVersionPreviewUrlView.as_view(), name='record-version-preview-url'),
    path('<uuid:pk>/qr-code/', views.RecordQRCodeView.as_view(), name='record-qr-code'),
    path('<uuid:pk>/permissions/', views.DocumentPermissionView.as_view(), name='record-permissions'),
    path('<uuid:pk>/permissions/<int:perm_id>/', views.DocumentPermissionDeleteView.as_view(), name='record-permission-delete'),
    path('<uuid:pk>/audit/', views.RecordAuditLogView.as_view(), name='record-audit'),
    path('bulk/', views.RecordBulkUpdateView.as_view(), name='record-bulk'),
    path('series/', views.RecordSeriesListView.as_view(), name='record-series-list'),
]
