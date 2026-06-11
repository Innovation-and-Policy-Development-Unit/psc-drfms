import { Badge } from '@/components/ui/Badge'

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  download: 'Download',
  upload_version: 'Upload version',
  approve: 'Approve',
  reject: 'Reject',
  share: 'Share',
  share_access: 'Link accessed',
  sign: 'Signed',
  legal_hold: 'Legal hold',
  legal_hold_lift: 'Hold lifted',
  destroy: 'Destroyed',
  custody_transfer: 'Custody transfer',
  login: 'Login',
  logout: 'Logout',
  login_failed: 'Login failed',
  export: 'Export',
}

/** Five registry tones — not a 21-color dashboard map. */
const AUDIT_ACTION_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  view: 'neutral',
  create: 'success',
  update: 'info',
  delete: 'danger',
  download: 'info',
  upload_version: 'info',
  approve: 'success',
  reject: 'danger',
  share: 'warning',
  share_access: 'warning',
  sign: 'info',
  legal_hold: 'warning',
  legal_hold_lift: 'success',
  destroy: 'danger',
  custody_transfer: 'info',
  login: 'neutral',
  logout: 'neutral',
  login_failed: 'danger',
  export: 'info',
}

export function AuditActionBadge({ action }: { action: string }) {
  return (
    <Badge tone={AUDIT_ACTION_TONE[action] ?? 'neutral'}>
      {AUDIT_ACTION_LABELS[action] ?? action.replace(/_/g, ' ')}
    </Badge>
  )
}

export const AUDIT_ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
]
