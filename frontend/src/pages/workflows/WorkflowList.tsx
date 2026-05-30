import { Link } from 'react-router-dom'
import { useWorkflows } from '@/hooks/useWorkflows'
import { PageShell } from '@/components/ui/PageShell'
import { Table, TableHead, TableBody } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { WorkflowStatusBadge } from '@/lib/workflowStatus'
import { Badge } from '@/components/ui/Badge'

export default function WorkflowList() {
  const { instances, loading } = useWorkflows()

  return (
    <PageShell title="Workflows" subtitle="Active and completed approval instances.">
      <Table>
        <TableHead>
          <tr>
            {['Title', 'Record', 'Step', 'Status', 'Initiated', ''].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            instances.map((inst) => {
              const stepName = inst.currentStepName ?? (inst as { current_step_name?: string }).current_step_name
              const isOverdue = inst.isOverdue ?? (inst as { is_overdue?: boolean }).is_overdue
              const daysRemaining = inst.daysRemaining ?? (inst as { days_remaining?: number | null }).days_remaining
              const initiated = inst.initiatedAt ?? inst.initiated_at
              const recordRef = inst.recordReference ?? inst.record_reference
              const currentStep = inst.currentStep ?? inst.current_step

              return (
                <tr key={inst.id}>
                  <td className="font-medium">
                    {inst.title}
                    {isOverdue && (
                      <Badge tone="danger" className="ms-2">Overdue</Badge>
                    )}
                  </td>
                  <td className="font-mono-ref text-xs">{recordRef || '—'}</td>
                  <td>
                    <span className="text-sm">{stepName || `Step ${currentStep}`}</span>
                    {daysRemaining != null && inst.status === 'in_progress' && (
                      <span className="block text-xs text-muted tabular-nums">
                        {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`}
                      </span>
                    )}
                  </td>
                  <td><WorkflowStatusBadge status={inst.status} /></td>
                  <td className="text-muted">
                    {initiated ? new Date(initiated).toLocaleDateString() : '—'}
                  </td>
                  <td className="text-end">
                    <Link to={`/workflows/${inst.id}`} className="btn-ghost btn-sm">Open</Link>
                  </td>
                </tr>
              )
            })
          )}
        </TableBody>
      </Table>
    </PageShell>
  )
}
