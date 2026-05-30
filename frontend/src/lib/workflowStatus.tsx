import { Badge } from '@/components/ui/Badge'
import {
  WORKFLOW_STATUS_FILTERS,
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUS_TONE,
  type WorkflowStatus,
} from '@/types/workflow'

export type { WorkflowStatus } from '@/types/workflow'
export { WORKFLOW_STATUS_FILTERS, WORKFLOW_STATUS_LABELS }

export function WorkflowStatusBadge({ status }: { status: string }) {
  const key = status as WorkflowStatus
  const label = WORKFLOW_STATUS_LABELS[key] ?? status.replace(/_/g, ' ')
  const tone = WORKFLOW_STATUS_TONE[key] ?? 'neutral'
  return <Badge tone={tone}>{label}</Badge>
}
