from django.urls import path
from . import views

urlpatterns = [
    path('overview/', views.AnalyticsOverviewView.as_view(), name='analytics-overview'),
    path('dashboard/', views.DashboardStatsView.as_view(), name='analytics-dashboard'),
    path('records-by-type/', views.RecordsByTypeView.as_view(), name='records-by-type'),
    path('records-by-month/', views.RecordsByMonthView.as_view(), name='records-by-month'),
    path('workflow-performance/', views.WorkflowPerformanceView.as_view(), name='workflow-performance'),
    path('user-activity/', views.UserActivityView.as_view(), name='user-activity'),
    path('activity/', views.ActivityView.as_view(), name='analytics-activity'),
    path('team-feed/', views.TeamFeedView.as_view(), name='analytics-team-feed'),
    path('compliance/', views.ComplianceDashboardView.as_view(), name='compliance-dashboard'),
]
