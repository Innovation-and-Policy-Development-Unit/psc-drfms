import { useState, useEffect, FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import clsx from 'clsx'
import { workflowApi } from '@/api'
import type { WorkflowInstance, WorkflowAction } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { WorkflowStatusBadge } from '@/lib/workflowStatus'

const STEP_ACTION_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  revision_required: 'warning',
}

export default function WorkflowDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [instance, setInstance] = useState<WorkflowInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    workflowApi.getInstance(id)
      .then(({ data }) => setInstance(data))
      .catch(() => setError('Workflow not found.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const actions = instance?.actions ?? []
  const currentStep = instance?.currentStep ?? (instance as { current_step?: number })?.current_step
  const pendingAction = actions.find((a) => {
    const step = a.stepNumber ?? a.step_number
    return step === currentStep && a.action === 'pending'
  })

  const handleAction = async (action: string) => {
    setSubmitting(true)
    setError('')
    try {
      await workflowApi.actionWorkflow(id, { action, comments })
      setComments('')
      load()
    } catch (err) {
      if (isAxiosError(err)) {
        setError(String(err.response?.data?.detail ?? 'Action failed.'))
      } else {
        setError('Action failed.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !instance) {
    return (
      <PageShell title="Workflow" subtitle="Loading…">
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </PageShell>
    )
  }

  if (!instance) {
    return (
      <PageShell title="Workflow not found">
        <Panel className="text-center py-12">
          <p className="text-secondary">{error || 'This workflow could not be loaded.'}</p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>Go back</Button>
        </Panel>
      </PageShell>
    )
  }

  const recordId = (instance as { record?: string }).record
  const recordRef = instance.recordReference ?? (instance as { record_reference?: string }).record_reference
  const initiatedBy = (instance as { initiatedByName?: string; initiated_by_name?: string }).initiatedByName
    ?? (instance as { initiated_by_name?: string }).initiated_by_name
  const initiatedAt = instance.initiatedAt ?? (instance as { initiated_at?: string }).initiated_at
  const completedAt = instance.completedAt ?? (instance as { completed_at?: string }).completed_at
  const notes = (instance as { notes?: string }).notes

  return (
    <PageShell
      title={instance.title}
      subtitle={recordRef ? `Record ${recordRef}` : undefined}
      action={<WorkflowStatusBadge status={instance.status} />}
    >
      <div className="max-w-3xl space-y-4">
        <button type="button" onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          Back
        </button>

        <Panel className="space-y-4">
          {recordId && (
            <p className="text-sm text-secondary">
              Linked record{' '}
              <Link to={`/document/${recordId}`} className="font-mono-ref text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))] hover:underline">
                {recordRef}
              </Link>
            </p>
          )}
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="label-overline">Current step</dt>
              <dd className="mt-1 font-medium">{currentStep}</dd>
            </div>
            <div>
              <dt className="label-overline">Initiated by</dt>
              <dd className="mt-1 font-medium">{initiatedBy || '—'}</dd>
            </div>
            <div>
              <dt className="label-overline">Started</dt>
              <dd className="mt-1">{initiatedAt ? new Date(initiatedAt).toLocaleString() : '—'}</dd>
            </div>
            {completedAt && (
              <div>
                <dt className="label-overline">Completed</dt>
                <dd className="mt-1">{new Date(completedAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
          {notes && <p className="text-sm text-secondary border-t border-registry pt-4">{notes}</p>}
        </Panel>

        <Panel>
          <h2 className="font-serif text-base font-semibold mb-4">Approval steps</h2>
          <div className="space-y-2">
            {actions.map((action: WorkflowAction) => {
              const stepNum = action.stepNumber ?? action.step_number
              const stepName = action.stepName ?? action.step_name
              const assignee = action.assignedToName ?? action.assigned_to_name
              return (
                <div
                  key={action.id}
                  className={clsx(
                    'flex items-start justify-between gap-3 p-3 border border-registry rounded-sm',
                    action.action === 'pending' && 'bg-[var(--status-warning-bg)]',
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Step {stepNum}: {stepName}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {assignee || 'Unassigned'}
                      {action.deadline && ` · due ${new Date(action.deadline).toLocaleDateString()}`}
                    </p>
                    {action.comments && (
                      <p className="text-xs text-secondary mt-1 italic">{action.comments}</p>
                    )}
                  </div>
                  <Badge tone={STEP_ACTION_TONE[action.action] ?? 'neutral'}>
                    {action.action.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )
            })}
          </div>
        </Panel>

        {pendingAction && instance.status === 'in_progress' && (
          <Panel className="space-y-4 border-[var(--brand-navy)]">
            <h2 className="font-serif text-base font-semibold">Your action required</h2>
            <p className="text-sm text-secondary">
              Assigned step: <strong>{pendingAction.stepName ?? pendingAction.step_name}</strong>
            </p>
            {error && <div className="alert-danger text-sm">{error}</div>}
            <textarea
              className="input resize-none text-sm"
              rows={3}
              placeholder="Comments (optional)"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              <Button disabled={submitting} onClick={() => handleAction('approved')}>Approve</Button>
              <Button variant="secondary" disabled={submitting} onClick={() => handleAction('revision_required')}>
                Request revision
              </Button>
              <Button variant="danger" disabled={submitting} onClick={() => handleAction('rejected')}>
                Reject
              </Button>
            </div>
          </Panel>
        )}

        {recordId && (
          <Link to={`/document/${recordId}`} className="btn-ghost btn-sm inline-flex">
            Open document
          </Link>
        )}
      </div>
    </PageShell>
  )
}
