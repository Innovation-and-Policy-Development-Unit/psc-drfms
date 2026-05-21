from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.DashboardStatsView.as_view(), name='analytics-dashboard'),
    path('records-by-type/', views.RecordsByTypeView.as_view(), name='records-by-type'),
    path('records-by-month/', views.RecordsByMonthView.as_view(), name='records-by-month'),
    path('workflow-performance/', views.WorkflowPerformanceView.as_view(), name='workflow-performance'),
    path('user-activity/', views.UserActivityView.as_view(), name='user-activity'),
    path('compliance/', views.ComplianceDashboardView.as_view(), name='compliance-dashboard'),
]
