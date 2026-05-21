from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers
from django.utils import timezone
from .models import LegalHold, DestructionCertificate, RetentionSchedule
from apps.accounts.permissions import IsRecordsOfficerOrAbove, IsDirectorOrAbove, IsAdministrator


class LegalHoldSerializer(serializers.ModelSerializer):
    applied_by_name = serializers.CharField(source='applied_by.get_full_name', read_only=True)
    records_count = serializers.SerializerMethodField()

    class Meta:
        model = LegalHold
        fields = '__all__'

    def get_records_count(self, obj):
        return obj.records.count()


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


class DestructionCertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DestructionCertificate
        fields = '__all__'
        read_only_fields = ['certificate_number', 'created_at']


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


class RetentionScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RetentionSchedule
        fields = '__all__'


class RetentionScheduleListView(generics.ListCreateAPIView):
    queryset = RetentionSchedule.objects.select_related('record_series').all()
    serializer_class = RetentionScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdministrator]


class OverdueRecordsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDirectorOrAbove]

    def get(self, request):
        from apps.records.models import Record
        from apps.records.serializers import RecordListSerializer
        today = timezone.now().date()
        overdue = Record.objects.filter(
            retention_date__lt=today,
            destroyed_at__isnull=True,
            is_vital=False,
            is_on_legal_hold=False,
        ).select_related('record_series', 'custodian')
        return Response(RecordListSerializer(overdue, many=True).data)
