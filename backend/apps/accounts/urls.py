from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenBlacklistView
from . import views

urlpatterns = [
    path('token/', views.CustomTokenObtainPairView.as_view(), name='token-obtain'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('token/logout/', TokenBlacklistView.as_view(), name='token-blacklist'),

    path('me/', views.MeView.as_view(), name='me'),
    path('me/password/', views.PasswordChangeView.as_view(), name='password-change'),

    path('2fa/setup/', views.TwoFactorSetupView.as_view(), name='2fa-setup'),
    path('2fa/verify/', views.TwoFactorVerifyView.as_view(), name='2fa-verify'),

    path('delegation/', views.DelegationView.as_view(), name='delegation'),

    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('users/<int:pk>/suspend/', views.UserSuspendView.as_view(), name='user-suspend'),
    path('users/<int:pk>/reactivate/', views.UserReactivateView.as_view(), name='user-reactivate'),

    path('departments/', views.DepartmentListView.as_view(), name='department-list'),
]
