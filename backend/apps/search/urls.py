from django.urls import path
from . import views

urlpatterns = [
    path('', views.UnifiedSearchView.as_view(), name='unified-search'),
    path('analytics/', views.SearchAnalyticsView.as_view(), name='search-analytics'),
]
