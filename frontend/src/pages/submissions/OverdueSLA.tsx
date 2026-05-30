import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { workflowApi, unwrapList } from '@/api'
import type { WorkflowInstance } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'

const SLA_DAYS = 21

interface SlaInfo {
  remaining: number
  label: string
  tone: 'danger' | 'warning' | 'success' | 'neutral'
  pct: number
}

function slaStatus(initiatedAt?: string | null, status?: string): SlaInfo | null {
  if (!initiatedAt) return null
  if (status && ['approved', 'rejected', 'cancelled'].includes(status)) return null
  const ageDays = Math.floor((Date.now() - new Date(initiatedAt).getTime()) / 86400000)
  const remaining = SLA_DAYS - ageDays
  const pct = Math.min(Math.round((ageDays / SLA_DAYS) * 100), 100)

  if (remaining < 0) {
    return { remaining, label: `${Math.abs(remaining)}d overdue`, tone: 'danger', pct: 100 }
  }
  if (remaining <= 3) {
    return { remaining, label: `${remaining}d left`, tone: 'warning', pct }
  }
  return { remaining, label: `${remaining}d left`, tone: 'success', pct }
}

type AnnotatedInstance = WorkflowInstance & { sla: SlaInfo | null }

export default function OverdueSLA() {
  const navigate = useNavigate()
  const [all, setAll] = useState<AnnotatedInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    workflowApi.getInstances({ status: 'in_progress', page_size: '200' })
      .then(({ data }) => {
        const list = unwrapList<WorkflowInstance>(data)
        setAll(
          list
            .map((inst) => ({ ...inst, sla: slaStatus(inst.initiatedAt, inst.status) }))
            .filter((inst): inst is AnnotatedInstance => inst.sla != null)
            .sort((a, b) => a.sla!.remaining - b.sla!.remaining),
        )
      })
      .catch(() => setAll([]))
      .finally(() => setLoading(false))
  }, [])

  const overdue = all.filter((i) => i.sla!.remaining < 0)
  const warning = all.filter((i) => i.sla!.remaining >= 0 && i.sla!.remaining <= 3)
  const onTrack = all.filter((i) => i.sla!.remaining > 3)
  const displayed = showAll ? all : all.filter((i) => i.sla!.remaining <= 3)

  return (
    <PageShell
      title="Overdue / SLA"
      subtitle="PSSM 21-day statutory review tracking."
    >
      {!loading && all.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span><Badge tone="danger">{overdue.length} overdue</Badge></span>
          <span><Badge tone="warning">{warning.length} due within 3 days</Badge></span>
          <span><Badge tone="success">{onTrack.length} on track</Badge></span>
        </div>
      )}

      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="registry-table">
            <thead>
              <tr>
                {['Submission', 'Reference', 'Step', 'SLA progress', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={5} cols={5} />
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      title="No submissions at risk"
                      description="Active workflows within the PSSM review window appear here."
                    />
                  </td>
                </tr>
              ) : (
                displayed.map((inst) => {
                  const { sla } = inst
                  return (
                    <tr
                      key={inst.id}
                      className={clsx(
                        'cursor-pointer',
                        sla!.remaining < 0 && 'bg-[var(--status-danger-bg)]',
                        sla!.remaining >= 0 && sla!.remaining <= 3 && 'bg-[var(--status-warning-bg)]',
                      )}
                      onClick={() => navigate(`/workflows/${inst.id}`)}
                    >
                      <td className="font-medium text-[var(--text-primary)] max-w-[200px] truncate">
                        {inst.title}
                      </td>
                      <td className="font-mono-ref text-xs">{inst.recordReference || '—'}</td>
                      <td>Step {inst.currentStep}</td>
                      <td className="min-w-[160px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Badge tone={sla!.tone}>{sla!.label}</Badge>
                            <span className="text-xs text-muted">{SLA_DAYS}d SLA</span>
                          </div>
                          <div className="h-1 bg-[var(--surface-sunken)] overflow-hidden rounded-sm">
                            <div
                              className={clsx(
                                'h-full',
                                sla!.tone === 'danger' && 'bg-[var(--status-danger-fg)]',
                                sla!.tone === 'warning' && 'bg-[var(--status-warning-fg)]',
                                sla!.tone === 'success' && 'bg-[var(--status-success-fg)]',
                              )}
                              style={{ width: `${sla!.pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="text-end text-muted text-xs">Open</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && onTrack.length > 0 && !showAll && (
          <div className="px-4 py-3 border-t border-registry text-center">
            <button type="button" onClick={() => setShowAll(true)} className="btn-ghost btn-sm">
              Show {onTrack.length} on-track submission{onTrack.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </Panel>
    </PageShell>
  )
}
