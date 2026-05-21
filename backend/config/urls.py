from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),

    # API v1
    path('api/auth/', include('apps.accounts.urls')),
    path('api/records/', include('apps.records.urls')),
    path('api/workflows/', include('apps.workflows.urls')),
    path('api/correspondence/', include('apps.correspondence.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/search/', include('apps.search.urls')),
    path('api/compliance/', include('apps.compliance.urls')),
    path('api/collaboration/', include('apps.collaboration.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/sharing/', include('apps.sharing.urls')),
    path('api/management/', include('apps.api_management.urls')),

    # API schema / docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Health check
    path('api/health/', include('apps.api_management.health_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
