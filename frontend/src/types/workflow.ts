export type WorkflowStatus =
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'rejected'
  | 'revision_required'
  | 'cancelled'

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_required: 'Revision required',
  cancelled: 'Cancelled',
}

export type WorkflowStatusTone = 'neutral' | 'info' | 'success' | 'danger' | 'warning'

export const WORKFLOW_STATUS_TONE: Record<WorkflowStatus, WorkflowStatusTone> = {
  pending: 'neutral',
  in_progress: 'info',
  approved: 'success',
  rejected: 'danger',
  revision_required: 'warning',
  cancelled: 'neutral',
}

export const WORKFLOW_STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  ...Object.entries(WORKFLOW_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]
