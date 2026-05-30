import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, Star, Clock, Upload, Search, Users } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { recordsApi, workflowApi, notificationsApi, unwrapList } from '@/api'
import type { RecordListItem, WorkflowAction } from '@/types/api'
import { RecordGridCard } from '@/components/documents/RecordGridCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'

const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']
const NO_RO = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']

const QUICK_LINKS = [
  { to: '/browse', label: 'Cloud Drive', icon: Cloud },
  { to: '/starred', label: 'Starred', icon: Star },
  { to: '/recent', label: 'Recent', icon: Clock },
  { to: '/shared-with-me', label: 'Shared', icon: Users },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/upload', label: 'Upload', icon: Upload, officerOnly: true },
]

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
  const firstName = user?.firstName || user?.first_name || 'there'

  useEffect(() => {
    const calls: Promise<unknown>[] = [notificationsApi.activity({ limit: 8 })]
    if (canBrowse) {
      calls.push(recordsApi.getRecords({ page_size: 12, ordering: '-updated_at' }))
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
      <div className="p-6 space-y-6 animate-registry-in max-w-3xl">
        <header>
          <h1 className="page-title">Welcome, {firstName}</h1>
          <p className="text-sm text-muted mt-1">Track requests and messages from the Public Service Commission.</p>
        </header>
        <div className="flex gap-3">
          <Link to="/inbox" className="btn-primary">Inbox</Link>
          <Link to="/search" className="btn-secondary">Search records</Link>
        </div>
      </div>
    )
  }

  const visibleLinks = QUICK_LINKS.filter((l) => !l.officerOnly || isOfficer)

  return (
    <div className="p-6 space-y-8 animate-registry-in">
      <header>
        <h1 className="page-title">Cloud Drive</h1>
        <p className="text-sm text-muted mt-1">Good day, {firstName}. Your registry at a glance.</p>
      </header>

      <section>
        <h2 className="label-overline mb-3">Quick access</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {visibleLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="drive-file-tile border border-registry rounded-md bg-raised hover:border-[var(--border-strong)]"
            >
              <div className="drive-tile-icon bg-[var(--surface-sunken)] text-[var(--brand-navy)]">
                <Icon size={24} strokeWidth={1.75} />
              </div>
              <span className="drive-tile-name">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="label-overline">Recent files</h2>
            <Link to="/browse" className="text-xs text-[var(--brand-navy)] hover:underline">View all</Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-32 rounded-md" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center border border-dashed border-registry rounded-md">
              No recent records. <Link to="/upload" className="text-[var(--brand-navy)] hover:underline">Upload one</Link>
            </p>
          ) : (
            <div className="drive-file-grid !p-0">
              {recent.slice(0, 8).map((r) => (
                <RecordGridCard key={r.id} record={r} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="label-overline">My tasks</h2>
              <Link to="/workflows/my-tasks" className="text-xs text-[var(--brand-navy)] hover:underline">All</Link>
            </div>
            {loading ? (
              <Skeleton lines={4} />
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted">No pending approvals.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={task.instance ? `/workflows/${task.instance}` : '/workflows/my-tasks'}
                      className="block panel-interactive px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{task.stepName ?? task.step_name}</span>
                        {task.isOverdue && <Badge tone="warning">Overdue</Badge>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="label-overline mb-3">Activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">No recent activity.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {activity.slice(0, 5).map((item) => (
                  <li key={`${item.type}-${item.id}`}>
                    <Link to={item.relatedUrl || '/inbox'} className="block py-1.5 hover:text-[var(--brand-navy)] truncate">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
