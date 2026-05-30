import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { recordsApi, workflowApi, notificationsApi, unwrapList } from '@/api'
import type { RecordListItem, WorkflowAction } from '@/types/api'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'

const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']
const NO_RO = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']

interface ActivityItem {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  relatedUrl?: string
}

export default function DocumentsHome() {
  const { user } = useAuth()
  const [recent, setRecent] = useState<RecordListItem[]>([])
  const [tasks, setTasks] = useState<WorkflowAction[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const role = user?.role ?? 'read_only'
  const isOfficer = OFFICER.includes(role)
  const canBrowse = NO_RO.includes(role)
  const firstName = user?.firstName || 'there'

  useEffect(() => {
    const calls: Promise<unknown>[] = [notificationsApi.activity({ limit: 8 })]
    if (canBrowse) {
      calls.push(recordsApi.getRecords({ page_size: 8, ordering: '-updated_at' }))
      calls.push(workflowApi.getMyTasks())
    }

    Promise.all(calls)
      .then(([act, rec, t]) => {
        const actData = act as { data: { results?: ActivityItem[] } }
        setActivity(actData.data.results ?? [])
        if (rec) {
          const recData = rec as { data: { results?: RecordListItem[] } | RecordListItem[] }
          setRecent(unwrapList(recData.data))
        }
        if (t) {
          const tData = t as { data: WorkflowAction[] | { results: WorkflowAction[] } }
          setTasks(unwrapList(tData.data).slice(0, 6))
        }
      })
      .finally(() => setLoading(false))
  }, [canBrowse])

  if (role === 'read_only') {
    return (
      <div className="space-y-6 animate-registry-in">
        <header>
          <h1 className="font-serif text-xl font-semibold">Welcome, {firstName}</h1>
          <p className="text-sm text-muted mt-1">Track requests and messages from the Public Service Commission.</p>
        </header>
        <div className="flex gap-3">
          <Link to="/inbox" className="btn-primary">Inbox</Link>
          <Link to="/search" className="btn-secondary">Search records</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-registry-in">
      <header className="border-b border-registry pb-4">
        <h1 className="page-title">Registry desk</h1>
        <p className="text-sm text-muted mt-1">Good day, {firstName}. Your queue and recent filings.</p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,1fr)] gap-6">
        <section className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="label-overline">Pending approvals</h2>
            <Link to="/workflows/my-tasks" className="text-xs text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))] hover:underline">
              View all
            </Link>
          </div>
          <Panel className="p-0">
            {loading ? (
              <div className="p-4"><Skeleton lines={4} /></div>
            ) : tasks.length === 0 ? (
              <p className="p-4 text-sm text-muted">No pending workflow actions.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={task.instance ? `/workflows/${task.instance}` : '/workflows/my-tasks'}
                      className="block px-4 py-3 hover:bg-[var(--surface-sunken)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{task.stepName}</span>
                        {task.isOverdue && <Badge tone="warning">Overdue</Badge>}
                      </div>
                      {task.daysRemaining != null && (
                        <p className="text-xs text-muted mt-0.5">
                          {task.daysRemaining >= 0 ? `${task.daysRemaining} days left` : `${Math.abs(task.daysRemaining)} days overdue`}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {isOfficer && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Link to="/upload" className="btn-primary btn-sm">Upload record</Link>
              <Link to="/submissions/new" className="btn-secondary btn-sm">New submission</Link>
              <Link to="/browse" className="btn-ghost btn-sm">Browse registry</Link>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <h2 className="label-overline">Recently updated</h2>
          <Panel className="p-0">
            {loading ? (
              <div className="p-4"><Skeleton lines={5} /></div>
            ) : recent.length === 0 ? (
              <p className="p-4 text-sm text-muted">No recent records.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link to={`/document/${r.id}`} className="block px-4 py-2.5 hover:bg-[var(--surface-sunken)]">
                      <p className="font-mono-ref text-[10px] text-muted">{r.referenceNumber}</p>
                      <p className="text-sm truncate text-[var(--text-primary)]">{r.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <h2 className="label-overline">Activity</h2>
          <Panel className="p-0 max-h-48 overflow-y-auto custom-scrollbar">
            {activity.length === 0 ? (
              <p className="p-4 text-sm text-muted">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {activity.slice(0, 5).map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link to={item.relatedUrl || '/inbox'} className="block px-4 py-2 text-sm hover:bg-[var(--surface-sunken)]">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted truncate">{item.message}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  )
}
