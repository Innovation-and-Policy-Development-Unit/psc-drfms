from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from .models import LegalHold, DestructionCertificate, RetentionSchedule, DispositionReview
from .serializers import (
    LegalHoldSerializer, DestructionCertificateSerializer, RetentionScheduleSerializer,
    DispositionReviewSerializer,
)
from apps.accounts.permissions import IsRecordsOfficerOrAbove, IsDirectorOrAbove, IsAdministrator


class LegalHoldListView(generics.ListCreateAPIView):
    queryset = LegalHold.objects.all()
    serializer_class = LegalHoldSerializer
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def perform_create(self, serializer):
        hold = serializer.save(applied_by=self.request.user)
        for record in hold.records.all():
            record.is_on_legal_hold = True
            record.save(update_fields=['is_on_legal_hold'])
        from apps.notifications.utils import send_notification
        send_notification(
            user_id=self.request.user.id,
            title='Legal Hold Applied',
            message=f'Legal hold "{hold.title}" applied to {hold.records.count()} record(s).',
            notification_type='legal_hold',
        )


class LegalHoldDetailView(generics.RetrieveUpdateAPIView):
    queryset = LegalHold.objects.all()
    serializer_class = LegalHoldSerializer
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]


class LegalHoldLiftView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def post(self, request, pk):
        hold = LegalHold.objects.get(pk=pk)
        if not hold.is_active:
            return Response({'detail': 'Hold is already lifted.'}, status=400)
        hold.lift(request.user)
        return Response({'detail': 'Legal hold lifted.'})


class DestructionCertificateListView(generics.ListCreateAPIView):
    queryset = DestructionCertificate.objects.all()
    serializer_class = DestructionCertificateSerializer
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def perform_create(self, serializer):
        serializer.save(authorised_by=self.request.user)


class DestructionCertificateDetailView(generics.RetrieveAPIView):
    queryset = DestructionCertificate.objects.all()
    serializer_class = DestructionCertificateSerializer
    permission_classes = [permissions.IsAuthenticated]


class DestructionApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def post(self, request, pk):
        cert = DestructionCertificate.objects.get(pk=pk)
        action = request.data.get('action', 'approve')
        if action == 'approve':
            cert.status = 'approved'
            cert.approved_by = request.user
            cert.approved_at = timezone.now()
            cert.save(update_fields=['status', 'approved_by', 'approved_at'])
            return Response({'detail': 'Destruction approved.'})
        elif action == 'reject':
            cert.status = 'rejected'
            cert.save(update_fields=['status'])
            return Response({'detail': 'Destruction rejected.'})
        return Response({'detail': 'Invalid action.'}, status=400)


class RetentionScheduleListView(generics.ListCreateAPIView):
    queryset = RetentionSchedule.objects.select_related('record_series').all()
    serializer_class = RetentionScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]


class DispositionReviewListView(generics.ListAPIView):
    serializer_class = DispositionReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsRecordsOfficerOrAbove]

    def get_queryset(self):
        qs = DispositionReview.objects.select_related(
            'record__record_series', 'decided_by',
        )
        status_filter = self.request.query_params.get('status', 'pending')
        if status_filter != 'all':
            qs = qs.filter(status=status_filter)
        return qs


class DispositionReviewDecideView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def post(self, request, pk):
        review = DispositionReview.objects.select_related('record').get(pk=pk)
        if review.status != 'pending':
            return Response({'detail': 'Review has already been decided.'}, status=400)
        action = request.data.get('action')
        if action not in ('approve', 'dismiss'):
            return Response({'detail': 'Action must be "approve" or "dismiss".'}, status=400)
        review.decide(request.user, approve=(action == 'approve'), notes=request.data.get('notes', ''))

        from apps.audit.utils import log_action
        log_action(request, 'update', review.record, extra={
            'event': 'disposition_review_decided',
            'review_id': str(review.id),
            'decision': review.status,
            'proposed_action': review.proposed_action,
        })
        return Response(DispositionReviewSerializer(review).data)


class RetentionScanTriggerView(APIView):
    """Run the retention scan on demand (also runs nightly via Celery beat)."""
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]

    def post(self, request):
        from .tasks import scan_retention_due
        scan_retention_due.delay()
        return Response({'detail': 'Retention scan queued.'}, status=status.HTTP_202_ACCEPTED)


class OverdueRecordsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        from apps.records.models import Record
        from apps.records.serializers import RecordListSerializer
        today = timezone.localdate()
        overdue = Record.objects.filter(
            retention_date__lt=today,
            destroyed_at__isnull=True,
            is_vital=False,
            is_on_legal_hold=False,
        ).select_related('record_series', 'custodian')
        return Response(RecordListSerializer(overdue, many=True).data)
