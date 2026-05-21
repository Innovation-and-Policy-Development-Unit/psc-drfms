from django.urls import path
from . import views

urlpatterns = [
    path('templates/', views.WorkflowTemplateListView.as_view(), name='workflow-template-list'),
    path('templates/<int:pk>/', views.WorkflowTemplateDetailView.as_view(), name='workflow-template-detail'),
    path('instances/', views.WorkflowInstanceListView.as_view(), name='workflow-instance-list'),
    path('instances/<uuid:pk>/', views.WorkflowInstanceDetailView.as_view(), name='workflow-instance-detail'),
    path('instances/<uuid:pk>/action/', views.WorkflowActionView.as_view(), name='workflow-action'),
    path('my-tasks/', views.MyTasksView.as_view(), name='workflow-my-tasks'),
]
