from django.urls import path

from . import appearance

urlpatterns = [
    path('', appearance.AppearanceView.as_view(), name='appearance'),
    path('me/', appearance.MyAppearanceView.as_view(), name='appearance-me'),
    path('org/', appearance.OrgAppearanceView.as_view(), name='appearance-org'),
]
