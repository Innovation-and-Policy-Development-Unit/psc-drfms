from django.urls import path
from . import views

urlpatterns = [
    path('records/<uuid:record_id>/comments/', views.CommentListView.as_view(), name='comment-list'),
    path('comments/<uuid:pk>/', views.CommentDetailView.as_view(), name='comment-detail'),
    path('records/<uuid:record_id>/review-rounds/', views.ReviewRoundListView.as_view(), name='review-round-list'),
    path('review-rounds/<uuid:pk>/', views.ReviewRoundDetailView.as_view(), name='review-round-detail'),
    path('review-rounds/<uuid:pk>/close/', views.ReviewRoundCloseView.as_view(), name='review-round-close'),
    path('review-rounds/<uuid:pk>/respond/', views.ReviewRoundRespondView.as_view(), name='review-round-respond'),
]
