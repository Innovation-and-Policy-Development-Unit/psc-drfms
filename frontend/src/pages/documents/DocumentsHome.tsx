import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderOpen, Star, Clock, Upload, Search, Users, Lock, AlertTriangle,
  GitBranch, TrendingUp, ArrowRight, ShieldCheck, Bell, FileText,
  type LucideIcon,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { recordsApi, workflowApi, notificationsApi, analyticsApi, unwrapList } from '@/api'
import type { RecordListItem, WorkflowAction, DashboardStats } from '@/types/api'
import { RecordGridCard } from '@/components/documents/RecordGridCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'

const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']
const PIE_COLORS = ['#465fff', '#12b76a', '#f79009', '#0ba5ec', '#7a5af8', '#f04438', '#ee46bc', '#667085']

interface ActivityItem {
  id: string
  type: string
  title: string
  message: string
  timestamp: string
  relatedUrl?: string
}

interface KpiProps {
  label: string
  value: number | string | undefined
  icon: LucideIcon
  tone: string
  to?: string
  hint?: string
}

function Kpi({ label, value, icon: Icon, tone, to, hint }: KpiProps) {
  const body = (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition-all hover:shadow-theme-md hover:-translate-y-0.5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={20} />
      </div>
      <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white tabular-nums">
        {value ?? '—'}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
  return to ? <Link to={to} className="block">{body}</Link> : body
}

function Card({ title, action, children, className = '' }: {
  title: string
  action?: { to: string; label: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white font-sans">{title}</h2>
        {action && (
          <Link to={action.to} className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600">
            {action.label} <ArrowRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export default function DocumentsHome() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [recent, setRecent] = useState<RecordListItem[]>([])
  const [tasks, setTasks] = useState<WorkflowAction[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [byMonth, setByMonth] = useState<Array<{ month: string; count: number }>>([])
  const [byType, setByType] = useState<Array<{ name: string; value: number }>>([])
  const [loading, setLoading] = useState(true)

  const role = user?.role ?? 'read_only'
  const isOfficer = OFFICER.includes(role)
  const firstName = user?.firstName || user?.first_name || ''

  useEffect(() => {
    Promise.allSettled([
      notificationsApi.activity({ limit: 8 }),
      recordsApi.getRecords({ page_size: 8, ordering: '-updated_at' }),
      workflowApi.getMyTasks(),
      analyticsApi.getDashboard(),
      analyticsApi.getRecordsByMonth(),
      analyticsApi.getRecordsByType(),
    ])
      .then(([act, rec, tk, st, mon, typ]) => {
        if (act.status === 'fulfilled') {
          setActivity(((act.value as { data: { results?: ActivityItem[] } }).data.results) ?? [])
        }
        if (rec.status === 'fulfilled') {
          setRecent(unwrapList((rec.value as { data: { results?: RecordListItem[] } | RecordListItem[] }).data))
        }
        if (tk.status === 'fulfilled') {
          setTasks(unwrapList((tk.value as { data: WorkflowAction[] | { results: WorkflowAction[] } }).data).slice(0, 5))
        }
        if (st.status === 'fulfilled') setStats(st.value.data)
        if (mon.status === 'fulfilled') setByMonth(mon.value.data)
        if (typ.status === 'fulfilled') {
          setByType(typ.value.data.map((d) => ({ name: d.documentType.replace(/_/g, ' '), value: d.count })))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const compliancePct = stats && stats.totalRecords > 0
    ? Math.max(0, Math.round(((stats.totalRecords - stats.overdueRecords) / stats.totalRecords) * 100))
    : 100
  const overdueTasks = tasks.filter((t) => t.isOverdue).length
  const attention = [
    { count: stats?.overdueRecords ?? 0, label: 'records past retention date', to: '/compliance/overdue', icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15', show: isOfficer },
    { count: overdueTasks, label: 'approvals overdue', to: '/workflows/my-tasks', icon: Clock, tone: 'bg-red-50 text-red-600 dark:bg-red-500/15', show: true },
    { count: stats?.onLegalHold ?? 0, label: 'records frozen by legal hold', to: '/compliance/legal-holds', icon: Lock, tone: 'bg-purple-50 text-purple-600 dark:bg-purple-500/15', show: isOfficer },
    { count: stats?.pendingWorkflows ?? 0, label: 'workflows in progress', to: '/workflows', icon: GitBranch, tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15', show: isOfficer },
  ].filter((a) => a.show && a.count > 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const quick: Array<{ to: string; label: string; icon: LucideIcon; officerOnly?: boolean }> = [
    { to: '/browse', label: t('nav.all_files'), icon: FolderOpen },
    { to: '/search', label: t('nav.search'), icon: Search },
    { to: '/starred', label: t('nav.starred'), icon: Star },
    { to: '/shared-with-me', label: t('nav.shared_with_me'), icon: Users },
    { to: '/upload', label: t('nav.upload'), icon: Upload, officerOnly: true },
  ]

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 p-6 sm:p-8 text-white shadow-theme-md">
        <div className="pointer-events-none absolute -end-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 end-40 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-white/70">
              <ShieldCheck size={14} /> Government of Vanuatu · Public Service Commission
            </p>
            <h1 className="mt-3 font-sans text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              {greeting}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Your registry at a glance — records, approvals and compliance across the Digital Records &amp; File Management System.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quick.filter((q) => !q.officerOnly || isOfficer).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <Icon size={15} /> {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total Records" value={stats?.totalRecords} icon={FolderOpen} tone="bg-primary-50 text-primary-500 dark:bg-primary-500/15" to="/browse" hint={stats ? `${stats.recordsThisMonth} added this month` : undefined} />
        <Kpi label="Active Workflows" value={stats?.pendingWorkflows} icon={GitBranch} tone="bg-sky-50 text-sky-600 dark:bg-sky-500/15" to={isOfficer ? '/workflows' : '/workflows/my-tasks'} />
        <Kpi label="On Legal Hold" value={stats?.onLegalHold} icon={Lock} tone="bg-purple-50 text-purple-600 dark:bg-purple-500/15" to={isOfficer ? '/compliance/legal-holds' : undefined} />
        <Kpi label="Overdue Retention" value={stats?.overdueRecords} icon={AlertTriangle} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/15" to={isOfficer ? '/compliance/overdue' : undefined} hint="Past retention date" />
      </div>

      {/* Compliance + attention */}
      {stats && stats.totalRecords > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Retention compliance">
            <div className="flex items-center gap-5">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.5" className="stroke-gray-100 dark:stroke-white/10" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.5" strokeLinecap="round"
                    className={compliancePct >= 95 ? 'stroke-emerald-500' : compliancePct >= 80 ? 'stroke-amber-500' : 'stroke-red-500'}
                    strokeDasharray={`${compliancePct} 100`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums text-gray-900 dark:text-white">
                  {compliancePct}%
                </span>
              </div>
              <p className="text-sm text-gray-500">
                of records are within their retention period.
                {stats.overdueRecords > 0 && <> <strong className="text-gray-800 dark:text-gray-200">{stats.overdueRecords}</strong> need a disposal decision.</>}
              </p>
            </div>
          </Card>

          <Card title="Needs attention" className="lg:col-span-2">
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-600"><ShieldCheck size={16} /> Nothing needs attention right now.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link to={a.to} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.tone}`}><a.icon size={16} /></span>
                      <span className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-200">
                        <strong className="tabular-nums">{a.count}</strong> {a.label}
                      </span>
                      <ArrowRight size={14} className="text-gray-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Records ingested — last 12 months" className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-64" />
          ) : byMonth.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-sm text-gray-400">
              <TrendingUp size={28} className="mb-2 opacity-60" />
              No ingestion data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={byMonth} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="ingest" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#465fff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#465fff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7ec" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7ec', fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#465fff" strokeWidth={2.5} fill="url(#ingest)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Records by type">
          {loading ? (
            <Skeleton className="h-64" />
          ) : byType.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-sm text-gray-400">
              <FileText size={28} className="mb-2 opacity-60" />
              No records yet
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                    {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e4e7ec', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-3 space-y-1.5 text-xs">
                {byType.slice(0, 5).map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-2 capitalize truncate">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.name}
                    </span>
                    <span className="font-medium tabular-nums">{d.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Recent + side */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={t('home.recent_files')} action={{ to: '/browse', label: t('topbar.view_all') }} className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-10 text-center dark:border-gray-800">
              <FolderOpen size={28} className="mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">{t('home.no_recent')}</p>
              {isOfficer && (
                <Link to="/upload" className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
                  <Upload size={14} /> {t('home.upload_one')}
                </Link>
              )}
            </div>
          ) : (
            <div className="drive-file-grid !p-0">
              {recent.slice(0, 8).map((r) => <RecordGridCard key={r.id} record={r} />)}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title={t('home.my_tasks')} action={{ to: '/workflows/my-tasks', label: t('topbar.view_all') }}>
            {loading ? (
              <Skeleton lines={3} />
            ) : tasks.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-gray-400"><Clock size={15} /> {t('home.no_tasks')}</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      to={task.instance ? `/workflows/${task.instance}` : '/workflows/my-tasks'}
                      className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
                    >
                      <span className="truncate font-medium text-gray-800 dark:text-gray-200">{task.stepName ?? task.step_name}</span>
                      {task.isOverdue && <Badge tone="warning">{t('home.overdue')}</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t('home.activity')} action={{ to: '/inbox', label: t('topbar.view_all') }}>
            {activity.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-gray-400"><Bell size={15} /> {t('home.no_activity')}</p>
            ) : (
              <ul className="space-y-3">
                {activity.slice(0, 5).map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                    <Link to={item.relatedUrl || '/inbox'} className="min-w-0 text-sm text-gray-700 hover:text-primary-500 dark:text-gray-300">
                      <span className="block truncate font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-gray-400">{item.message}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
