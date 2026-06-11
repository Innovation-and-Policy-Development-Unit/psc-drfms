from django.contrib import admin
from .models import Comment, ReviewRound


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['author', 'record', 'is_internal', 'created_at']
    list_filter = ['is_internal']


@admin.register(ReviewRound)
class ReviewRoundAdmin(admin.ModelAdmin):
    list_display = ['title', 'record', 'opened_by', 'is_open', 'opened_at']
    list_filter = ['is_open']
