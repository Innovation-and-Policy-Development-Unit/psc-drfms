from django.contrib import admin
from .models import NoResultSearch


@admin.register(NoResultSearch)
class NoResultSearchAdmin(admin.ModelAdmin):
    list_display = ['query', 'count', 'last_searched']
    ordering = ['-count']
