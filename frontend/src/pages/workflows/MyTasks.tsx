import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { workflowApi, unwrapList } from '@/api'
import { featuresApi, type Assignment } from '@/api/features'
import { aiErrorMessage } from '@/api/ai'
import { formatDate } from '@/lib/driveFormat'
import type { WorkflowAction } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

function timeLeft(deadline?: string | null) {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return { label: 'Overdue', overdue: true }
  const days = Math.floor(ms / 86400000)
  if (days === 0) return { label: 'Due today', urgent: true }
  if (days === 1) return { label: '1 day left', urgent: true }
  return { label: `${days} days left`, overdue: false }
}

const changed = () => window.dispatchEvent(new Event('drfms:assignments-changed'))

export default function MyTasks() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<WorkflowAction[]>([])
  const [mine, setMine] = useState<Assignment[]>([])
  const [given, setGiven] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAssignments = useCallback(() => {
    featuresApi.myAssignments({ scope: 'mine' }).then(({ data }) => setMine(data.results)).catch(() => setMine([]))
    featuresApi.myAssignments({ scope: 'given' }).then(({ data }) => setGiven(data.results)).catch(() => setGiven([]))
  }, [])

  useEffect(() => {
    loadAssignments()
    workflowApi.getMyTasks()
      .then(({ data }) => setTasks(unwrapList(data)))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [loadAssignments])

  const act = async (a: Assignment, action: 'complete' | 'cancel') => {
    setError('')
    try { await featuresApi.assignmentAction(a.id, action); loadAssignments(); changed() } catch (e) { setError(aiErrorMessage(e)) }
  }

  const assignmentRow = (a: Assignment, own: boolean) => (
    <div key={a.id} className={clsx('panel flex flex-wrap items-center gap-3 p-4', a.isOverdue && '!border-[var(--status-danger-fg)]')}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{a.instruction}</p>
        <p className="mt-0.5 text-sm text-muted">
          <Link to={`/document/${a.recordId}`} className="hover:underline">{a.referenceNumber} {a.recordTitle}</Link>
          {' · '}{own ? `from ${a.assignedByName || 'someone'}` : `to ${a.assignedToName}`}
          {a.dueDate ? ` · due ${formatDate(a.dueDate)}` : ''}
        </p>
      </div>
      {a.isOverdue && <Badge tone="danger">Overdue</Badge>}
      <Button size="sm" variant="secondary" onClick={() => navigate(`/document/${a.recordId}`)}>Open</Button>
      {own
        ? <Button size="sm" onClick={() => act(a, 'complete')}>Mark done</Button>
        : <Button size="sm" variant="ghost" onClick={() => act(a, 'cancel')}>Cancel</Button>}
    </div>
  )

  const nothing = !loading && tasks.length === 0 && mine.length === 0

  return (
    <PageShell title="My tasks" subtitle="Work assigned to you: assignments from colleagues and workflow approval steps.">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : nothing && given.length === 0 ? (
        <EmptyState title="No pending tasks" description="Assignments and approvals will appear here." />
      ) : (
        <div className="space-y-8">
          {mine.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Assigned to you</h2>
              {mine.map((a) => assignmentRow(a, true))}
            </section>
          )}

          {tasks.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Approvals waiting for you</h2>
              {tasks.map((task) => {
                const tl = timeLeft(task.deadline)
                const title = task.stepName ?? task.step_name
                return (
                  <div
                    key={task.id}
                    className={clsx(
                      'panel-interactive flex items-center gap-4 p-4 cursor-pointer',
                      tl?.overdue && '!border-[var(--status-danger-fg)]',
                    )}
                    onClick={() => navigate(`/workflows/${task.instance}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{title}</p>
                      <p className="text-sm text-muted">
                        {task.deadline ? `Due ${new Date(task.deadline).toLocaleDateString()}` : 'No deadline'}
                      </p>
                    </div>
                    {tl && <Badge tone={tl.overdue ? 'danger' : tl.urgent ? 'warning' : 'neutral'}>{tl.label}</Badge>}
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${task.instance}`) }}>Review</Button>
                  </div>
                )
              })}
            </section>
          )}

          {given.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">You asked others to do</h2>
              {given.map((a) => assignmentRow(a, false))}
            </section>
          )}
        </div>
      )}
    </PageShell>
  )
}
