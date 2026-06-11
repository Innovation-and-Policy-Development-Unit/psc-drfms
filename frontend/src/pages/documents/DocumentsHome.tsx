import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, Star, Clock, Upload, Search, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { recordsApi, workflowApi, notificationsApi, unwrapList } from '@/api'
import type { RecordListItem, WorkflowAction } from '@/types/api'
import { RecordGridCard } from '@/components/documents/RecordGridCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'

const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']

const QUICK_LINKS = [
  { to: '/browse', labelKey: 'nav.all_files', icon: Cloud },
  { to: '/starred', labelKey: 'nav.starred', icon: Star },
  { to: '/recent', labelKey: 'nav.recent', icon: Clock },
  { to: '/shared-with-me', labelKey: 'nav.shared_with_me', icon: Users },
  { to: '/search', labelKey: 'nav.search', icon: Search },
  { to: '/upload', labelKey: 'nav.upload', icon: Upload, officerOnly: true },
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
  const { t } = useTranslation()
  const { user } = useAuth()
  const [recent, setRecent] = useState<RecordListItem[]>([])
  const [tasks, setTasks] = useState<WorkflowAction[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const role = user?.role ?? 'read_only'
  const isOfficer = OFFICER.includes(role)
  const firstName = user?.firstName || user?.first_name || ''

  useEffect(() => {
    // All roles may browse — the API filters records by clearance server-side
    Promise.all([
      notificationsApi.activity({ limit: 8 }),
      recordsApi.getRecords({ page_size: 12, ordering: '-updated_at' }),
      workflowApi.getMyTasks(),
    ])
      .then(([act, rec, tk]) => {
        const actData = act as { data: { results?: ActivityItem[] } }
        setActivity(actData.data.results ?? [])
        const recData = rec as { data: { results?: RecordListItem[] } | RecordListItem[] }
        setRecent(unwrapList(recData.data))
        const tData = tk as { data: WorkflowAction[] | { results: WorkflowAction[] } }
        setTasks(unwrapList(tData.data).slice(0, 6))
      })
      .finally(() => setLoading(false))
  }, [])

  const visibleLinks = QUICK_LINKS.filter((l) => !l.officerOnly || isOfficer)

  return (
    <div className="p-6 space-y-8 animate-registry-in">
      <header>
        <h1 className="page-title">PSC-DRFMS</h1>
        <p className="text-sm text-muted mt-1">{t('home.greeting', { name: firstName })}</p>
      </header>

      <section>
        <h2 className="label-overline mb-3">{t('home.quick_access')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {visibleLinks.map(({ to, labelKey, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="drive-file-tile border border-registry rounded-md bg-raised hover:border-[var(--border-strong)]"
            >
              <div className="drive-tile-icon bg-[var(--surface-sunken)] text-[var(--brand-navy)]">
                <Icon size={24} strokeWidth={1.75} />
              </div>
              <span className="drive-tile-name">{t(labelKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_280px] gap-8">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="label-overline">{t('home.recent_files')}</h2>
            <Link to="/browse" className="text-xs text-[var(--brand-navy)] hover:underline">{t('topbar.view_all')}</Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-32 rounded-md" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center border border-dashed border-registry rounded-md">
              {t('home.no_recent')}{' '}
              {isOfficer && <Link to="/upload" className="text-[var(--brand-navy)] hover:underline">{t('home.upload_one')}</Link>}
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
              <h2 className="label-overline">{t('home.my_tasks')}</h2>
              <Link to="/workflows/my-tasks" className="text-xs text-[var(--brand-navy)] hover:underline">{t('topbar.view_all')}</Link>
            </div>
            {loading ? (
              <Skeleton lines={4} />
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted">{t('home.no_tasks')}</p>
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
                        {task.isOverdue && <Badge tone="warning">{t('home.overdue')}</Badge>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="label-overline mb-3">{t('home.activity')}</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">{t('home.no_activity')}</p>
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
