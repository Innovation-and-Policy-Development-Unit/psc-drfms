"""
Seed PSC-DRFMS with demo users, libraries, documents (from files), workflows, and activity.

Usage (Docker):
  docker compose exec backend python manage.py seed_system
  docker compose exec backend python manage.py seed_system --source-dir /seed/docs

Mount your Documents folder for live files:
  docker compose run --rm -v "/mnt/c/Users/USER/Documents:/seed/docs:ro" backend \\
    python manage.py seed_system --source-dir /seed/docs --max-files 20
"""
import hashlib
import mimetypes
import os
from datetime import date, timedelta
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.fixtures import create_superuser
from apps.accounts.models import Department, User, UserRole
from apps.collaboration.models import Comment
from apps.compliance.models import LegalHold, RetentionSchedule
from apps.notifications.models import Notification, NotificationType
from apps.records.models import (
    DocumentPermission,
    DocumentType,
    Record,
    RecordSeries,
    RecordStar,
    RecordVersion,
    ClassificationLevel,
)
from apps.sharing.models import SharedLink
from apps.workflows.models import WorkflowAction, WorkflowInstance, WorkflowStep, WorkflowTemplate

SEED_MARKER = '[SEED]'
ALLOWED_EXT = {'.pdf', '.docx', '.doc', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.txt'}
MAX_FILE_BYTES = 10 * 1024 * 1024


class Command(BaseCommand):
    help = 'Seed database with sample users, libraries, documents, workflows, and notifications.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--source-dir',
            type=str,
            default='',
            help='Folder of files to import (default: backend/seed_samples)',
        )
        parser.add_argument('--max-files', type=int, default=30, help='Max files to import')
        parser.add_argument(
            '--flush',
            action='store_true',
            help='Remove previously seeded records (titles starting with [SEED])',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Run even if seed data already exists',
        )

    def handle(self, *args, **options):
        if Record.objects.filter(title__startswith=SEED_MARKER).exists() and not options['force'] and not options['flush']:
            self.stdout.write(self.style.WARNING(
                'Seed data already present. Use --force to add more or --flush to reset seeded records.'
            ))
            return

        if options['flush']:
            self._flush_seed_data()

        with transaction.atomic():
            create_superuser()
            users = self._seed_users()
            series_map = self._seed_series()
            source = self._resolve_source_dir(options['source_dir'])
            records = self._seed_records_from_files(
                source, users, series_map, options['max_files']
            )
            self._seed_collaboration(records, users)
            self._seed_workflows(records, users)
            self._seed_compliance(records, users)
            self._seed_notifications(records, users)

        self.stdout.write(self.style.SUCCESS(
            f'Seed complete: {len(records)} documents from {source}'
        ))
        self.stdout.write('Login: admin@psc.gov.vu / Admin@123!')
        self.stdout.write('Also: officer@psc.gov.vu, reviewer@psc.gov.vu (password: Demo@123!)')

    def _flush_seed_data(self):
        qs = Record.objects.filter(title__startswith=SEED_MARKER)
        count = qs.count()
        qs.delete()
        WorkflowTemplate.objects.filter(name__startswith=SEED_MARKER).delete()
        LegalHold.objects.filter(title__startswith=SEED_MARKER).delete()
        self.stdout.write(self.style.WARNING(f'Removed {count} seeded records.'))

    def _resolve_source_dir(self, arg_dir):
        if arg_dir:
            return Path(arg_dir)
        candidates = [
            Path('/app/seed_samples'),
            Path(__file__).resolve().parents[4] / 'seed_samples',
        ]
        for default in candidates:
            if default.is_dir() and any(p for p in default.iterdir() if p.is_file()):
                return default
        return candidates[-1]

    def _seed_users(self):
        dept, _ = Department.objects.get_or_create(
            code='OPSC',
            defaults={'name': 'Public Service Commission'},
        )
        dept_cs, _ = Department.objects.get_or_create(
            code='CS',
            defaults={'name': 'Corporate Services', 'parent': dept},
        )
        dept_ipdu, _ = Department.objects.get_or_create(
            code='IPDU',
            defaults={'name': 'Information & Project Delivery Unit', 'parent': dept},
        )

        specs = [
            ('officer@psc.gov.vu', 'records', 'Lei', 'Moli', UserRole.RECORDS_OFFICER, dept_cs),
            ('reviewer@psc.gov.vu', 'reviewer', 'Sarah', 'Kalsakau', UserRole.REVIEWER, dept_cs),
            ('director@psc.gov.vu', 'director', 'James', 'Thomas', UserRole.DIRECTOR, dept),
            ('commissioner@psc.gov.vu', 'commissioner', 'Chair', 'Commission', UserRole.COMMISSIONER, dept),
        ]
        users = {}
        admin = User.objects.filter(email='admin@psc.gov.vu').first()
        if admin:
            users['admin'] = admin
            if not admin.department_id:
                admin.department = dept
                admin.save(update_fields=['department'])

        for email, username, first, last, role, department in specs:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': username,
                    'first_name': first,
                    'last_name': last,
                    'role': role,
                    'department': department,
                    'is_active': True,
                },
            )
            if created or not user.check_password('Demo@123!'):
                user.set_password('Demo@123!')
            user.role = role
            user.department = department
            user.is_active = True
            user.is_2fa_required = False
            user.save()
            users[username] = user

        return users

    def _seed_series(self):
        roots = [
            ('ADM', 'Administration', None),
            ('HRM', 'Human Resource Management', None),
            ('IPDU', 'IPDU Programmes', None),
            ('LEG', 'Legal & Compliance', None),
        ]
        children = [
            ('HRM-POL', 'HR Policies', 'HRM'),
            ('HRM-DIS', 'Disciplinary Files', 'HRM'),
            ('IPDU-PROJ', 'Project Registers', 'IPDU'),
            ('IPDU-TECH', 'Technical Assessments', 'IPDU'),
            ('LEG-GRIEV', 'Grievance Processes', 'LEG'),
        ]
        by_code = {}
        for code, name, parent_code in roots:
            s, _ = RecordSeries.objects.get_or_create(
                code=code,
                defaults={'name': name, 'description': f'{name} record series', 'retention_years': 7},
            )
            by_code[code] = s
        for code, name, parent_code in children:
            parent = by_code.get(parent_code)
            s, _ = RecordSeries.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'parent': parent,
                    'description': f'{name} classification',
                    'retention_years': 10 if 'DIS' in code else 7,
                },
            )
            if parent and s.parent_id != parent.id:
                s.parent = parent
                s.save(update_fields=['parent'])
            by_code[code] = s
        return by_code

    def _collect_files(self, source_dir, max_files):
        paths = []
        source = Path(source_dir)
        if not source.is_dir():
            self.stdout.write(self.style.WARNING(f'Source dir not found: {source}'))
            return paths

        for root, _dirs, files in os.walk(source):
            depth = len(Path(root).relative_to(source).parts)
            if depth > 4:
                continue
            for name in sorted(files):
                p = Path(root) / name
                if p.suffix.lower() not in ALLOWED_EXT:
                    continue
                try:
                    if p.stat().st_size > MAX_FILE_BYTES or p.stat().st_size == 0:
                        continue
                except OSError:
                    continue
                paths.append(p)
                if len(paths) >= max_files:
                    return paths
        return paths

    def _guess_series(self, filename, series_map):
        lower = filename.lower()
        if 'grievance' in lower or 'disciplin' in lower:
            return series_map.get('HRM-DIS') or series_map.get('HRM')
        if 'ipdu' in lower or 'project' in lower or 'mfiles' in lower:
            return series_map.get('IPDU-PROJ') or series_map.get('IPDU')
        if 'technical' in lower or 'assessment' in lower:
            return series_map.get('IPDU-TECH') or series_map.get('IPDU')
        if 'training' in lower or 'ministries' in lower:
            return series_map.get('HRM-POL') or series_map.get('HRM')
        if 'ccms' in lower or 'case' in lower:
            return series_map.get('LEG') or series_map.get('ADM')
        if 'concept' in lower or 'commission' in lower or 'psc' in lower:
            return series_map.get('ADM')
        return series_map.get('ADM')

    def _guess_doc_type(self, filename):
        lower = filename.lower()
        if 'policy' in lower or 'process' in lower or 'grievance' in lower:
            return DocumentType.POLICY
        if 'assessment' in lower or 'brief' in lower:
            return DocumentType.REPORT
        if 'project' in lower or 'register' in lower:
            return DocumentType.SUBMISSION
        if 'training' in lower:
            return DocumentType.CIRCULAR
        if 'concept' in lower or 'overview' in lower:
            return DocumentType.BOARD_PAPER
        return DocumentType.OTHER

    def _seed_records_from_files(self, source_dir, users, series_map, max_files):
        paths = self._collect_files(source_dir, max_files)
        if not paths:
            self.stdout.write(self.style.WARNING('No files found to import.'))
            return []

        admin = users.get('admin') or User.objects.filter(is_superuser=True).first()
        officer = users.get('officer') or admin
        records = []
        today = date.today()

        for i, path in enumerate(paths):
            title = f"{SEED_MARKER} {path.stem.replace('_', ' ')[:120]}"
            if Record.objects.filter(title=title).exists():
                continue

            series = self._guess_series(path.name, series_map)
            record = Record(
                title=title,
                description=f'Seeded sample document imported from {path.name}.',
                document_type=self._guess_doc_type(path.name),
                classification_level=ClassificationLevel.INTERNAL,
                record_series=series,
                originating_ministry='Public Service Commission',
                custodian=officer,
                author=admin,
                document_date=today - timedelta(days=i * 3),
                is_draft=False,
                is_vital=(i == 0),
                tags=['seed', 'demo', path.suffix.lower().lstrip('.')],
            )
            record.save()

            with open(path, 'rb') as fh:
                content = fh.read()
            mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'

            version = RecordVersion(
                record=record,
                version_number=1,
                file_name=path.name,
                file_size=len(content),
                mime_type=mime,
                content_hash=hashlib.sha256(content).hexdigest(),
                change_summary='Initial version (seed import)',
                created_by=admin,
            )
            version.file.save(path.name, ContentFile(content), save=True)
            version.save()
            record.content_hash = version.content_hash
            record.is_draft = False
            record.retention_date = today + timedelta(days=365 * 7)
            record.scheduled_destruction_date = record.retention_date
            record.save(update_fields=['content_hash', 'is_draft', 'retention_date', 'scheduled_destruction_date'])
            records.append(record)
            self.stdout.write(f'  + {record.reference_number} — {path.name}')

        return records

    def _seed_collaboration(self, records, users):
        if not records:
            return
        admin = users.get('admin')
        reviewer = users.get('reviewer')
        officer = users.get('officer')

        for rec in records[:3]:
            Comment.objects.get_or_create(
                record=rec,
                author=reviewer or admin,
                body=f'Please review section 2 of {rec.title}. Looks good for circulation.',
                defaults={'is_internal': True},
            )

        if reviewer and records:
            DocumentPermission.objects.get_or_create(
                record=records[1],
                user=reviewer,
                defaults={
                    'can_view': True,
                    'can_edit': False,
                    'can_download': True,
                    'can_share': False,
                    'granted_by': admin,
                },
            )
            DocumentPermission.objects.get_or_create(
                record=records[2],
                user=reviewer,
                defaults={
                    'can_view': True,
                    'can_edit': True,
                    'can_download': True,
                    'can_share': True,
                    'granted_by': admin,
                },
            )

        if admin and records:
            for rec in records[:5]:
                RecordStar.objects.get_or_create(user=admin, record=rec)

        if admin and records:
            SharedLink.objects.get_or_create(
                record=records[0],
                created_by=admin,
                defaults={
                    'recipient_email': 'partner@gov.vu',
                    'recipient_name': 'External Partner',
                    'allow_download': True,
                },
            )

    def _seed_workflows(self, records, users):
        if not records:
            return
        admin = users.get('admin')
        reviewer = users.get('reviewer')
        director = users.get('director')

        template, _ = WorkflowTemplate.objects.get_or_create(
            name=f'{SEED_MARKER} Document approval',
            defaults={
                'description': 'Standard two-step review and approval for seeded documents.',
                'document_type': DocumentType.REPORT,
                'is_active': True,
                'created_by': admin,
            },
        )
        WorkflowStep.objects.get_or_create(
            template=template,
            step_number=1,
            defaults={
                'name': 'Records review',
                'role_required': UserRole.REVIEWER,
                'specific_user': reviewer,
                'deadline_working_days': 5,
            },
        )
        WorkflowStep.objects.get_or_create(
            template=template,
            step_number=2,
            defaults={
                'name': 'Director approval',
                'role_required': UserRole.DIRECTOR,
                'specific_user': director,
                'deadline_working_days': 3,
            },
        )

        record = records[0]
        instance, created = WorkflowInstance.objects.get_or_create(
            record=record,
            title=f'{SEED_MARKER} Approval: {record.title[:80]}',
            defaults={
                'template': template,
                'current_step': 1,
                'status': 'in_progress',
                'initiated_by': admin,
                'notes': 'Seeded workflow — approve to test task progression.',
            },
        )
        if created:
            step1 = template.steps.filter(step_number=1).first()
            WorkflowAction.objects.create(
                instance=instance,
                step_number=1,
                step_name=step1.name if step1 else 'Review',
                assigned_to=reviewer or admin,
                action='pending',
                deadline=timezone.now() + timedelta(days=5),
            )

    def _seed_compliance(self, records, users):
        if not records:
            return
        admin = users.get('admin')
        hold, _ = LegalHold.objects.get_or_create(
            title=f'{SEED_MARKER} Inquiry hold — sample',
            defaults={
                'reason': 'Demo legal hold for governance UI testing.',
                'hold_type': 'inquiry',
                'applied_by': admin,
                'is_active': True,
            },
        )
        if records:
            hold.records.add(records[min(2, len(records) - 1)])
            rec = records[min(2, len(records) - 1)]
            rec.is_on_legal_hold = True
            rec.save(update_fields=['is_on_legal_hold'])

        series = records[0].record_series if records else None
        if series:
            RetentionSchedule.objects.get_or_create(
                record_series=series,
                defaults={
                    'retention_years': 10,
                    'disposition_action': 'destroy',
                    'statutory_basis': 'Seeded retention schedule for demo.',
                },
            )

    def _seed_notifications(self, records, users):
        admin = users.get('admin')
        reviewer = users.get('reviewer')
        if not admin:
            return

        Notification.objects.get_or_create(
            user=admin,
            title='Welcome to PSC Documents',
            message='Your document library has been seeded with sample files.',
            notification_type=NotificationType.INFO,
            defaults={'related_url': '/'},
        )
        if records:
            Notification.objects.get_or_create(
                user=admin,
                title='Document shared with you',
                message=records[0].title[:100],
                notification_type=NotificationType.SHARE,
                related_record=records[0],
                defaults={'related_url': f'/document/{records[0].id}'},
            )
        if reviewer and records:
            Notification.objects.get_or_create(
                user=reviewer,
                title='Approval required',
                message=f'Review pending for {records[0].reference_number}',
                notification_type=NotificationType.WORKFLOW,
                related_record=records[0],
                defaults={'related_url': f'/workflows/my-tasks'},
            )
