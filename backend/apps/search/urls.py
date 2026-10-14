from django.urls import path
from . import advanced, views

urlpatterns = [
    path('', views.UnifiedSearchView.as_view(), name='unified-search'),
    path('suggest/', views.SearchSuggestView.as_view(), name='search-suggest'),
    path('similar/<uuid:pk>/', views.SimilarRecordsView.as_view(), name='search-similar'),
    path('semantic-status/', views.SemanticStatusView.as_view(), name='search-semantic-status'),
    path('advanced/', advanced.AdvancedSearchView.as_view(), name='search-advanced'),
    path('advanced/fields/', advanced.AdvancedSearchFieldsView.as_view(), name='search-advanced-fields'),
    path('analytics/', views.SearchAnalyticsView.as_view(), name='search-analytics'),
]
