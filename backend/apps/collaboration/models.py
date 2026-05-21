from django.db import models
from django.utils import timezone
import uuid


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey('records.Record', on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='comments')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    body = models.TextField()
    is_internal = models.BooleanField(default=False)
    mentioned_users = models.ManyToManyField('accounts.User', blank=True, related_name='mentioned_in')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author} on {self.record.reference_number}"


class ReviewRound(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    record = models.ForeignKey('records.Record', on_delete=models.CASCADE, related_name='review_rounds')
    title = models.CharField(max_length=300)
    instructions = models.TextField(blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    opened_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, related_name='opened_reviews')
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    is_open = models.BooleanField(default=True)

    class Meta:
        ordering = ['-opened_at']


class ReviewRoundReviewer(models.Model):
    review_round = models.ForeignKey(ReviewRound, on_delete=models.CASCADE, related_name='reviewers')
    reviewer = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True)
    has_responded = models.BooleanField(default=False)
    responded_at = models.DateTimeField(null=True, blank=True)
    response = models.TextField(blank=True)

    class Meta:
        unique_together = [['review_round', 'reviewer']]
