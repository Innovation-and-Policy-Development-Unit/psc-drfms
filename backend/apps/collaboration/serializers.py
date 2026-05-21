from rest_framework import serializers
from .models import Comment, ReviewRound, ReviewRoundReviewer


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'record', 'author', 'author_name',
            'parent', 'body', 'is_internal',
            'replies', 'created_at', 'updated_at',
        ]
        read_only_fields = ['author', 'record', 'created_at', 'updated_at']

    def get_replies(self, obj):
        """Only expand replies for top-level comments to avoid deep nesting."""
        if obj.parent is None:
            return CommentSerializer(
                obj.replies.filter(deleted_at__isnull=True),
                many=True,
                context=self.context,
            ).data
        return []


class ReviewRoundReviewerSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.get_full_name', read_only=True)
    reviewer_email = serializers.CharField(source='reviewer.email', read_only=True)

    class Meta:
        model = ReviewRoundReviewer
        fields = [
            'id', 'reviewer', 'reviewer_name', 'reviewer_email',
            'has_responded', 'responded_at', 'response',
        ]
        read_only_fields = ['has_responded', 'responded_at', 'response']


class ReviewRoundSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.CharField(source='opened_by.get_full_name', read_only=True)
    reviewers_detail = ReviewRoundReviewerSerializer(source='reviewers', many=True, read_only=True)
    reviewers_count = serializers.SerializerMethodField()
    responded_count = serializers.SerializerMethodField()

    class Meta:
        model = ReviewRound
        fields = [
            'id', 'record', 'title', 'instructions', 'deadline',
            'opened_by', 'opened_by_name', 'opened_at',
            'closed_at', 'is_open',
            'reviewers_detail', 'reviewers_count', 'responded_count',
        ]
        read_only_fields = ['opened_by', 'record', 'opened_at', 'closed_at']

    def get_reviewers_count(self, obj):
        return obj.reviewers.count()

    def get_responded_count(self, obj):
        return obj.reviewers.filter(has_responded=True).count()
