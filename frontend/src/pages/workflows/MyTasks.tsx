import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { workflowApi, unwrapList } from '@/api'
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

export default function MyTasks() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<WorkflowAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    workflowApi.getMyTasks()
      .then(({ data }) => setTasks(unwrapList(data)))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageShell title="My pending tasks" subtitle="Workflow steps assigned to you.">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState title="No pending tasks" description="Assigned approvals will appear here." />
      ) : (
        <div className="space-y-2">
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
                    {task.deadline
                      ? `Due ${new Date(task.deadline).toLocaleDateString()}`
                      : 'No deadline'}
                  </p>
                </div>
                {tl && (
                  <Badge tone={tl.overdue ? 'danger' : tl.urgent ? 'warning' : 'neutral'}>
                    {tl.label}
                  </Badge>
                )}
                <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/workflows/${task.instance}`) }}>
                  Review
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
