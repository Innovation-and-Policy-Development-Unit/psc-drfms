import { Badge } from '@/components/ui/Badge'

const NOTIFICATION_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger' | 'success'> = {
  workflow: 'info',
  legal_hold: 'warning',
  record: 'info',
  user: 'success',
  system: 'neutral',
  alert: 'danger',
}

const NOTIFICATION_LABEL: Record<string, string> = {
  workflow: 'Workflow',
  legal_hold: 'Legal hold',
  record: 'Record',
  user: 'User',
  system: 'System',
  alert: 'Alert',
}

export function NotificationCategoryBadge({ type }: { type?: string }) {
  const key = type ?? 'system'
  return (
    <Badge tone={NOTIFICATION_TONE[key] ?? 'neutral'}>
      {NOTIFICATION_LABEL[key] ?? key.replace(/_/g, ' ')}
    </Badge>
  )
}

export function timeAgo(dateStr?: string | null) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}
