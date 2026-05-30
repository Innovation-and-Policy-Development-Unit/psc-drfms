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

export default function AssignedSubmissions() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<WorkflowAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    workflowApi.getMyTasks()
      .then(({ data }) => setTasks(unwrapList(data)))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [])

  const overdueTasks = tasks.filter((t) => t.deadline && new Date(t.deadline) < new Date())
  const pendingTasks = tasks.filter((t) => !(t.deadline && new Date(t.deadline) < new Date()))

  return (
    <PageShell
      title="My assigned"
      subtitle="Submissions awaiting your review or approval."
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No assigned submissions"
          description="When a workflow step is assigned to you, it will appear here."
        />
      ) : (
        <div className="space-y-8">
          {overdueTasks.length > 0 && (
            <section className="space-y-2">
              <p className="label-overline">Overdue ({overdueTasks.length})</p>
              {overdueTasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpen={() => navigate(`/workflows/${task.instance}`)} />
              ))}
            </section>
          )}
          {pendingTasks.length > 0 && (
            <section className="space-y-2">
              <p className="label-overline">Pending ({pendingTasks.length})</p>
              {pendingTasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpen={() => navigate(`/workflows/${task.instance}`)} />
              ))}
            </section>
          )}
        </div>
      )}
    </PageShell>
  )
}

function TaskRow({ task, onOpen }: { task: WorkflowAction; onOpen: () => void }) {
  const tl = timeLeft(task.deadline)
  const title = task.instanceTitle ?? task.instance_title

  return (
    <div
      role="button"
      tabIndex={0}
      className={clsx(
        'panel-interactive flex items-center gap-4 p-4 cursor-pointer',
        tl?.overdue && '!border-[var(--status-danger-fg)]',
      )}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--text-primary)] truncate">{task.stepName ?? task.step_name}</p>
        {title && <p className="text-sm text-muted truncate">{title}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {tl && (
          <Badge tone={tl.overdue ? 'danger' : tl.urgent ? 'warning' : 'neutral'}>
            {tl.label}
          </Badge>
        )}
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpen() }}>
          Review
        </Button>
      </div>
    </div>
  )
}
