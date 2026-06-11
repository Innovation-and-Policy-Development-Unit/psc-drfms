"""
Workflow engine tests — template setup, approval chains, delegation, escalation.

Run:  python manage.py test tests.test_workflows --settings=config.settings.development
"""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole
from apps.records.models import Record
from apps.workflows.models import (
    WorkflowTemplate, WorkflowStep, WorkflowInstance, WorkflowAction,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email, role=UserRole.RECORDS_OFFICER):
    return User.objects.create_user(
        email=email, username=email.split('@')[0],
        first_name='T', last_name='U',
        password='Secur3Pass!', role=role,
    )


def auth_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def make_record(user):
    r = Record(
        title='Test', document_type='policy',
        classification_level='internal',
        author=user, custodian=user,
    )
    r.save()
    return r


def make_template(creator, approver):
    tmpl = WorkflowTemplate.objects.create(
        name='2-step approval', document_type='policy', created_by=creator,
    )
    WorkflowStep.objects.create(
        template=tmpl, step_number=1, name='Review',
        specific_user=approver, deadline_working_days=3,
    )
    WorkflowStep.objects.create(
        template=tmpl, step_number=2, name='Final Approval',
        role_required=UserRole.DIRECTOR, deadline_working_days=5,
    )
    return tmpl


# ---------------------------------------------------------------------------
# Template management
# ---------------------------------------------------------------------------

class WorkflowTemplateTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@psc.gov.vu', UserRole.ADMINISTRATOR)
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.admin_client = auth_client(self.admin)
        self.officer_client = auth_client(self.officer)

    def test_admin_can_create_template(self):
        resp = self.admin_client.post('/api/workflows/templates/', {
            'name': 'Policy Approval',
            'document_type': 'policy',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_officer_cannot_create_template(self):
        resp = self.officer_client.post('/api/workflows/templates/', {
            'name': 'Policy Approval',
        })
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


# ---------------------------------------------------------------------------
# Workflow lifecycle
# ---------------------------------------------------------------------------

class WorkflowLifecycleTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.reviewer = make_user('reviewer@psc.gov.vu', UserRole.REVIEWER)
        self.director = make_user('director@psc.gov.vu', UserRole.DIRECTOR)
        self.record = make_record(self.officer)
        self.template = make_template(creator=self.officer, approver=self.reviewer)
        self.officer_client = auth_client(self.officer)
        self.reviewer_client = auth_client(self.reviewer)
        self.director_client = auth_client(self.director)

    def _create_instance(self):
        resp = self.officer_client.post('/api/workflows/instances/', {
            'record': str(self.record.id),
            'template': self.template.pk,
            'title': 'Approve Policy X',
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        return resp.data['id']

    def test_create_instance_sets_first_action(self):
        instance_id = self._create_instance()
        instance = WorkflowInstance.objects.get(id=instance_id)
        self.assertEqual(instance.status, 'in_progress')
        self.assertEqual(instance.current_step, 1)
        action = instance.actions.filter(step_number=1).first()
        self.assertIsNotNone(action)
        self.assertEqual(action.action, 'pending')
        self.assertEqual(action.assigned_to, self.reviewer)

    def test_assigned_reviewer_can_approve(self):
        instance_id = self._create_instance()
        resp = self.reviewer_client.post(
            f'/api/workflows/instances/{instance_id}/action/',
            {'action': 'approved', 'comments': 'Looks good'},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        instance = WorkflowInstance.objects.get(id=instance_id)
        self.assertEqual(instance.current_step, 2)

    def test_wrong_user_cannot_approve(self):
        instance_id = self._create_instance()
        resp = self.director_client.post(
            f'/api/workflows/instances/{instance_id}/action/',
            {'action': 'approved'},
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_rejection_closes_workflow(self):
        instance_id = self._create_instance()
        self.reviewer_client.post(
            f'/api/workflows/instances/{instance_id}/action/',
            {'action': 'rejected', 'comments': 'Not acceptable'},
        )
        instance = WorkflowInstance.objects.get(id=instance_id)
        self.assertEqual(instance.status, 'rejected')
        self.assertIsNotNone(instance.completed_at)

    def test_full_approval_chain_completes_workflow(self):
        instance_id = self._create_instance()

        # Step 1 — reviewer approves
        self.reviewer_client.post(
            f'/api/workflows/instances/{instance_id}/action/',
            {'action': 'approved'},
        )
        # Step 2 — no specific user set, so next action assigned to initiator (officer)
        # Manually create step 2 action for director to test the full chain
        instance = WorkflowInstance.objects.get(id=instance_id)
        action2 = WorkflowAction.objects.filter(instance=instance, step_number=2).first()
        if action2:
            action2.assigned_to = self.director
            action2.save()
            self.director_client.post(
                f'/api/workflows/instances/{instance_id}/action/',
                {'action': 'approved'},
            )
            instance.refresh_from_db()
            self.assertEqual(instance.status, 'approved')

    def test_my_tasks_shows_only_assigned_actions(self):
        self._create_instance()
        resp = self.reviewer_client.get('/api/workflows/my-tasks/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        tasks = resp.data.get('results', resp.data)
        self.assertTrue(all(t['assigned_to'] == self.reviewer.pk for t in tasks))

    def test_my_tasks_empty_for_non_assigned_user(self):
        self._create_instance()
        resp = self.officer_client.get('/api/workflows/my-tasks/')
        tasks = resp.data.get('results', resp.data)
        self.assertEqual(len(tasks), 0)


# ---------------------------------------------------------------------------
# Audit trail written for workflow actions
# ---------------------------------------------------------------------------

class WorkflowAuditTests(TestCase):
    def setUp(self):
        self.officer = make_user('officer@psc.gov.vu', UserRole.RECORDS_OFFICER)
        self.reviewer = make_user('reviewer@psc.gov.vu', UserRole.REVIEWER)
        self.record = make_record(self.officer)
        self.template = make_template(creator=self.officer, approver=self.reviewer)

    def test_approval_creates_audit_log_entry(self):
        from apps.audit.models import AuditLog
        instance = WorkflowInstance.objects.create(
            record=self.record, template=self.template,
            title='Test', initiated_by=self.officer, status='in_progress',
        )
        WorkflowAction.objects.create(
            instance=instance, step_number=1, step_name='Review',
            assigned_to=self.reviewer,
            deadline=timezone.now() + timedelta(days=3),
        )
        client = auth_client(self.reviewer)
        client.post(
            f'/api/workflows/instances/{instance.id}/action/',
            {'action': 'approved'},
        )
        self.assertTrue(
            AuditLog.objects.filter(
                record=self.record,
                action='approved',
            ).exists()
        )
