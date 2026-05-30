import { Badge } from '@/components/ui/Badge'

export const DOC_TYPE_LABELS: Record<string, string> = {
  correspondence: 'Correspondence',
  personnel_file: 'Personnel file',
  board_paper: 'Board paper',
  policy: 'Policy',
  circular: 'Circular',
  report: 'Report',
  submission: 'Submission',
  disciplinary: 'Disciplinary',
  contract: 'Contract',
  financial: 'Financial',
  legal: 'Legal',
  other: 'Other',
}

const CLASSIFICATION_TONE = {
  unclassified: 'neutral',
  internal: 'info',
  confidential: 'warning',
  restricted: 'danger',
  secret: 'danger',
} as const

export function DocumentTypeBadge({ type }: { type?: string }) {
  if (!type) return null
  const label = DOC_TYPE_LABELS[type] ?? type.replace(/_/g, ' ')
  return <Badge tone="neutral">{label}</Badge>
}

export function ClassificationBadge({ level }: { level?: string }) {
  if (!level) return null
  const tone = CLASSIFICATION_TONE[level as keyof typeof CLASSIFICATION_TONE] ?? 'neutral'
  return <Badge tone={tone}>{level.replace(/_/g, ' ')}</Badge>
}

export function RecordLifecycleBadge({
  isOnLegalHold,
  isDraft,
}: {
  isOnLegalHold?: boolean
  isDraft?: boolean
}) {
  if (isOnLegalHold) return <Badge tone="danger">Legal hold</Badge>
  if (isDraft) return <Badge tone="neutral">Draft</Badge>
  return <Badge tone="success">Active</Badge>
}

export const DOCUMENT_TYPE_OPTIONS = Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export const CLASSIFICATION_OPTIONS = [
  { value: 'unclassified', label: 'Unclassified' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
]
