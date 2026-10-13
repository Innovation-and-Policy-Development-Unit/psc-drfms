from django.urls import path

from . import views

urlpatterns = [
    path('status/', views.AiStatusView.as_view(), name='ai-status'),
    path('ask/', views.AskArchiveView.as_view(), name='ai-ask'),
    path('review-queue/', views.ReviewQueueView.as_view(), name='ai-review-queue'),
    path('search/parse/', views.SearchParseView.as_view(), name='ai-search-parse'),
    path('records/<uuid:pk>/chat/', views.RecordChatView.as_view(), name='ai-record-chat'),
    path('records/<uuid:pk>/summary/', views.RecordSummaryView.as_view(), name='ai-record-summary'),
    path('records/<uuid:pk>/analyze/', views.RecordAnalyzeView.as_view(), name='ai-record-analyze'),
    path('records/<uuid:pk>/apply-retention/', views.ApplyRetentionView.as_view(), name='ai-apply-retention'),
    path('records/<uuid:pk>/review/', views.MarkReviewedView.as_view(), name='ai-mark-reviewed'),
    path('correspondence/<uuid:pk>/route/', views.CorrespondenceRouteView.as_view(), name='ai-route'),
    path('correspondence/<uuid:pk>/draft-reply/', views.CorrespondenceDraftView.as_view(), name='ai-draft-reply'),
]
