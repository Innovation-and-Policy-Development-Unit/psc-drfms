from django.urls import path
from . import views

urlpatterns = [
    path('', views.UnifiedSearchView.as_view(), name='unified-search'),
    path('suggest/', views.SearchSuggestView.as_view(), name='search-suggest'),
    path('analytics/', views.SearchAnalyticsView.as_view(), name='search-analytics'),
]
