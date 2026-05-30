import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { workflowApi, unwrapList } from '@/api'
import type { WorkflowInstance } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { WorkflowStatusBadge, WORKFLOW_STATUS_FILTERS } from '@/lib/workflowStatus'

export default function AllSubmissions() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatus] = useState('')

  useEffect(() => {
    const params = statusFilter ? { status: statusFilter } : {}
    workflowApi.getInstances(params)
      .then(({ data }) => setInstances(unwrapList(data)))
      .catch(() => setInstances([]))
      .finally(() => setLoading(false))
  }, [statusFilter])

  return (
    <PageShell
      title="All submissions"
      subtitle="PSSM approval workflows across the commission."
      action={
        <Button onClick={() => navigate('/submissions/new')}>
          New submission
        </Button>
      }
    >
      <div className="flex gap-2 flex-wrap">
        {WORKFLOW_STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setStatus(value)}
            className={clsx(
              'btn-sm border',
              statusFilter === value
                ? 'border-[var(--brand-navy)] bg-[var(--surface-sunken)] font-medium'
                : 'border-registry btn-secondary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="registry-table">
            <thead>
              <tr>
                {['Title', 'Reference', 'Step', 'Status', 'Initiated', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={6} cols={6} />
              ) : instances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      title={statusFilter ? 'No submissions with this status' : 'No submissions yet'}
                      description="Start a PSSM workflow when a record requires formal approval."
                      action={
                        <Button onClick={() => navigate('/submissions/new')}>
                          New submission
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                instances.map((inst) => (
                  <tr
                    key={inst.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/workflows/${inst.id}`)}
                  >
                    <td className="font-medium text-[var(--text-primary)] max-w-[220px] truncate">
                      {inst.title}
                    </td>
                    <td className="font-mono-ref text-xs">{inst.recordReference || '—'}</td>
                    <td>Step {inst.currentStep}</td>
                    <td><WorkflowStatusBadge status={inst.status} /></td>
                    <td className="whitespace-nowrap">
                      {inst.initiatedAt ? new Date(inst.initiatedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="text-end text-muted text-xs">Open</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageShell>
  )
}
