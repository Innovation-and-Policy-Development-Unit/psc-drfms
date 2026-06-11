export type UserRole =
  | 'read_only'
  | 'reviewer'
  | 'records_officer'
  | 'director'
  | 'commissioner'
  | 'administrator'

export interface User {
  id: number
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  /** Django API snake_case aliases */
  first_name?: string
  last_name?: string
  full_name?: string
  role: UserRole
  department?: number | null
  departmentName?: string
  jobTitle?: string
  isActive?: boolean
  is2faRequired?: boolean
  preferredLanguage?: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface RecordListItem {
  id: string
  referenceNumber: string
  title: string
  documentType: string
  classificationLevel: string
  recordSeries?: number | null
  recordSeriesName?: string
  originatingMinistry?: string
  custodian?: number | null
  custodianName?: string
  documentDate?: string | null
  isVital: boolean
  isOnLegalHold: boolean
  isDraft: boolean
  tags: string[]
  versionCount?: number
  fileName?: string
  mimeType?: string
  fileSize?: number
  isStarred?: boolean
  createdAt: string
  updatedAt: string
  matchSnippet?: string
  rank?: number
}

export interface RecordVersion {
  id: number
  fileName?: string
  file_name?: string
  mimeType?: string
  mime_type?: string
  fileSize?: number
  file_size?: number
  versionNumber?: number
  version_number?: number
}

export interface RecordDetail extends RecordListItem {
  reference_number?: string
  description?: string
  latestVersion?: RecordVersion
  latest_version?: RecordVersion
  custodian_name?: string
  is_starred?: boolean
  is_on_legal_hold?: boolean
  updated_at?: string
}

export interface LegalHold {
  id: string
  title: string
  reason: string
  holdType: string
  records: string[]
  recordSeries: number[]
  appliedByName?: string
  appliedAt: string
  liftedByName?: string
  liftedAt?: string | null
  isActive: boolean
  recordsCount: number
}

export interface DestructionCertificate {
  id: string
  certificateNumber: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  destructionMethod: string
  notes: string
  authorisedByName?: string
  approvedByName?: string
  createdAt: string
  approvedAt?: string | null
  completedAt?: string | null
  destroyedRecordsCount: number
}

export interface RetentionSchedule {
  id: number
  recordSeries: number
  recordSeriesCode: string
  recordSeriesName: string
  retentionYears: number
  reviewTrigger: string
  autoFlagForReview: boolean
  dispositionAction: string
  statutoryBasis: string
  updatedAt: string
}

export interface Correspondence {
  id: string
  referenceNumber: string
  direction: 'incoming' | 'outgoing' | 'internal'
  subject: string
  senderName: string
  senderOrganization: string
  recipientName: string
  correspondenceDate: string
  status: string
  priority: string
  isEmailIngested: boolean
  createdAt: string
}

export interface DashboardStats {
  totalRecords: number
  recordsThisMonth: number
  onLegalHold: number
  vitalRecords: number
  pendingWorkflows: number
  overdueRecords: number
  activeLegalHolds: number
}

export interface ComplianceDashboard {
  overdueRecords: number
  incompleteMetadata: number
  activeLegalHolds: number
  pendingDestructions: number
  vitalRecords: number
}

export interface WorkflowPerformance {
  averageCompletionDays: number | null
  overdueSteps: number
  totalCompleted: number
  totalInProgress: number
}

export interface AnalyticsOverview {
  stats: DashboardStats
  compliance: ComplianceDashboard
  workflow: WorkflowPerformance
  recordsByType: Array<{ documentType: string; count: number }>
}

export interface HealthCheck {
  status: 'healthy' | 'degraded'
  checks: Record<string, string>
  timestamp: string
}

export interface WorkflowInstance {
  id: string
  title: string
  status: string
  record?: string
  recordReference?: string
  record_reference?: string
  currentStep: number
  current_step?: number
  currentStepName?: string
  initiatedAt: string
  initiated_at?: string
  initiatedByName?: string
  initiated_by_name?: string
  completedAt?: string | null
  completed_at?: string | null
  notes?: string
  overdueStepsCount?: number
  isOverdue?: boolean
  is_overdue?: boolean
  daysRemaining?: number | null
  days_remaining?: number | null
  actions?: WorkflowAction[]
}

export interface WorkflowAction {
  id: number
  stepNumber?: number
  step_number?: number
  stepName?: string
  step_name?: string
  action: string
  deadline?: string | null
  isOverdue?: boolean
  is_overdue?: boolean
  daysRemaining?: number | null
  days_remaining?: number | null
  assignedToName?: string
  assigned_to_name?: string
  instance?: string
  instanceTitle?: string
  instance_title?: string
  comments?: string
}

/** Record shape returned by Django REST (snake_case) */
export interface ApiRecord {
  id: string
  reference_number?: string
  title: string
  mime_type?: string
  file_name?: string
  file_size?: number
  is_starred?: boolean
  is_vital?: boolean
  is_on_legal_hold?: boolean
  updated_at?: string
  classification_level?: string
  record_series_name?: string
  scheduled_destruction_date?: string | null
  retention_date?: string | null
  latest_version?: ApiRecordVersion
  [key: string]: unknown
}

export interface ApiRecordVersion {
  id: string
  version_number?: number
  file_name?: string
  mime_type?: string
  file_size?: number
  created_at?: string
  created_by_name?: string
  change_summary?: string
}

export interface NotificationItem {
  id: number | string
  title: string
  message: string
  isRead?: boolean
  is_read?: boolean
  notificationType?: string
  notification_type?: string
  relatedUrl?: string | null
  related_url?: string | null
  relatedRecord?: string | null
  related_record?: string | null
  timestamp?: string
}

export interface RecordSeries {
  id: number
  name: string
  parent?: number | null
}

export interface ShareLink {
  id: string
  token: string
  access_count?: number
  is_active?: boolean
  expires_at?: string | null
}

export interface AuditLogEntry {
  id: number | string
  action: string
  userName?: string
  userEmail?: string
  user_name?: string
  user_email?: string
  record?: string
  recordReference?: string
  record_reference?: string
  ipAddress?: string
  ip_address?: string
  timestamp: string
}

export interface Comment {
  id: number | string
  body: string
  author?: number
  author_name?: string
  created_at: string
  replies?: Comment[]
}

export interface RecordPermission {
  id: number | string
  user: number
  user_name?: string
  user_email?: string
  can_view?: boolean
  can_edit?: boolean
  can_download?: boolean
  can_share?: boolean
}

export interface BreadcrumbItem {
  label: string
  to?: string
}
