from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
import re
from .models import Comment, ReviewRound, ReviewRoundReviewer
from .serializers import CommentSerializer, ReviewRoundSerializer


class CommentListView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Comment.objects.filter(
            record_id=self.kwargs['record_id'],
            parent__isnull=True,
            deleted_at__isnull=True,
        ).select_related('author').prefetch_related('replies__author')
        if self.request.user.role in ('read_only', 'reviewer'):
            qs = qs.filter(is_internal=False)
        return qs

    def perform_create(self, serializer):
        comment = serializer.save(author=self.request.user, record_id=self.kwargs['record_id'])
        # Handle @mentions
        mentions = re.findall(r'@(\w+)', comment.body)
        if mentions:
            from apps.accounts.models import User
            mentioned = User.objects.filter(username__in=mentions)
            comment.mentioned_users.set(mentioned)
            for user in mentioned:
                from apps.notifications.utils import send_notification
                send_notification(
                    user_id=user.id,
                    title='You were mentioned in a comment',
                    message=f'{comment.author.get_full_name()} mentioned you on record {comment.record.reference_number}',
                    notification_type='mention',
                    related_record_id=str(comment.record_id),
                )


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.author != request.user:
            return Response({'detail': 'You can only delete your own comments.'}, status=403)
        comment.deleted_at = timezone.now()
        comment.body = '[deleted]'
        comment.save(update_fields=['deleted_at', 'body'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReviewRoundListView(generics.ListCreateAPIView):
    serializer_class = ReviewRoundSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ReviewRound.objects.filter(record_id=self.kwargs['record_id'])

    def perform_create(self, serializer):
        round_ = serializer.save(opened_by=self.request.user, record_id=self.kwargs['record_id'])
        reviewer_ids = self.request.data.get('reviewer_ids', [])
        for uid in reviewer_ids:
            ReviewRoundReviewer.objects.create(review_round=round_, reviewer_id=uid)
            from apps.notifications.utils import send_notification
            send_notification(
                user_id=uid,
                title='Review Required',
                message=f'You have been assigned to review: {round_.title}',
                notification_type='workflow',
                related_record_id=str(round_.record_id),
            )


class ReviewRoundDetailView(generics.RetrieveAPIView):
    queryset = ReviewRound.objects.prefetch_related('reviewers__reviewer')
    serializer_class = ReviewRoundSerializer
    permission_classes = [permissions.IsAuthenticated]


class ReviewRoundCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        round_ = ReviewRound.objects.get(pk=pk)
        if round_.opened_by != request.user:
            return Response({'detail': 'Only the opener can close this review.'}, status=403)
        round_.is_open = False
        round_.closed_at = timezone.now()
        round_.save(update_fields=['is_open', 'closed_at'])
        return Response({'detail': 'Review round closed.'})


class ReviewRoundRespondView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        round_ = ReviewRound.objects.get(pk=pk)
        reviewer = ReviewRoundReviewer.objects.filter(review_round=round_, reviewer=request.user).first()
        if not reviewer:
            return Response({'detail': 'You are not assigned to this review.'}, status=403)
        reviewer.has_responded = True
        reviewer.responded_at = timezone.now()
        reviewer.response = request.data.get('response', '')
        reviewer.save(update_fields=['has_responded', 'responded_at', 'response'])
        return Response({'detail': 'Response recorded.'})
