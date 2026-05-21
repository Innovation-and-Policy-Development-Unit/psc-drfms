import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { recordsApi, workflowApi, notificationsApi } from '../../api'
import FileCard from '../../components/drive/FileCard'
import {
  Upload, FolderOpen, ArrowRight, CheckCircle, Activity,
  Search, Bell, Send, Clock, AlertTriangle,
} from 'lucide-react'

const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']
const NO_RO   = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']

// ── Ministry / read-only home ────────────────────────────────────────────────

function MinistryHome({ firstName, activity, loading }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Welcome back, {firstName}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Track your requests and messages from the Public Service Commission.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          to="/inbox"
          className="flex items-center gap-3 p-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
        >
          <Bell size={22} />
          <div>
            <p className="font-semibold">Inbox</p>
            <p className="text-xs text-primary-100">Notifications from PSC</p>
          </div>
        </Link>
        <Link
          to="/search"
          className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-300 transition-colors"
        >
          <Search size={22} className="text-primary-600" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Search records</p>
            <p className="text-xs text-slate-500">Find documents shared with you</p>
          </div>
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity size={18} /> Recent activity
        </h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 skeleton rounded-lg" />
            ))}
          </div>
        ) : activity.length === 0 ? (
          <p className="text-sm text-slate-500">No recent activity.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map(item => (
              <li key={`${item.type}-${item.id}`}>
                <Link
                  to={item.related_url || '/inbox'}
                  className="block text-sm hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 truncate">{item.message}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Officer / reviewer home ──────────────────────────────────────────────────

export default function DocumentsHome() {
  const { user } = useAuth()
  const [recent, setRecent]   = useState([])
  const [tasks, setTasks]     = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const role      = user?.role ?? 'read_only'
  const isOfficer = OFFICER.includes(role)
  const canBrowse = NO_RO.includes(role)
  const firstName = user?.first_name || 'there'

  useEffect(() => {
    const calls = [
      notificationsApi.activity({ limit: 8 }),
    ]
    if (canBrowse) {
      calls.push(recordsApi.getRecords({ page_size: 8, ordering: '-updated_at' }))
      calls.push(workflowApi.getMyTasks())
    }

    Promise.all(calls)
      .then(([act, rec, t]) => {
        setActivity(act.data.results || [])
        if (rec) setRecent(rec.data.results || rec.data)
        if (t)   setTasks((t.data.results || t.data).slice(0, 5))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [canBrowse])

  if (role === 'read_only') {
    return <MinistryHome firstName={firstName} activity={activity} loading={loading} />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Welcome back, {firstName}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Your documents, versions, and approvals in one place.
        </p>
      </div>

      {/* Quick actions — scoped by role */}
      <div className="grid sm:grid-cols-3 gap-3">
        {isOfficer && (
          <Link
            to="/upload"
            className="flex items-center gap-3 p-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            <Upload size={22} />
            <div>
              <p className="font-semibold">Upload</p>
              <p className="text-xs text-primary-100">Add a new document</p>
            </div>
          </Link>
        )}
        {isOfficer && (
          <Link
            to="/submissions/new"
            className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-300 transition-colors"
          >
            <Send size={22} className="text-primary-600" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">New submission</p>
              <p className="text-xs text-slate-500">Start a PSSM workflow</p>
            </div>
          </Link>
        )}
        <Link
          to="/browse"
          className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-300 transition-colors"
        >
          <FolderOpen size={22} className="text-primary-600" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">All files</p>
            <p className="text-xs text-slate-500">Browse everything</p>
          </div>
        </Link>
        <Link
          to="/workflows/my-tasks"
          className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-300 transition-colors"
        >
          <CheckCircle size={22} className="text-primary-600" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Approvals</p>
            <p className="text-xs text-slate-500">
              {loading ? '—' : `${tasks.length} pending task${tasks.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent files */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent files</h2>
            <Link to="/recent" className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="aspect-[4/3] skeleton rounded-lg" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-12 text-center">
              <FolderOpen size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No documents yet</p>
              {isOfficer && (
                <Link to="/upload" className="btn-primary mt-4 inline-flex items-center gap-2">
                  <Upload size={16} /> Upload your first file
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {recent.map(r => <FileCard key={r.id} record={r} />)}
            </div>
          )}
        </section>

        {/* Activity feed */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity size={18} /> Activity
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-lg" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map(item => (
                <li key={`${item.type}-${item.id}`}>
                  <Link
                    to={item.related_url || '/'}
                    className="block text-sm hover:text-primary-600"
                  >
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 truncate">{item.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Pending tasks */}
      {!loading && tasks.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">My pending tasks</h3>
            <Link to="/workflows/my-tasks" className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.map(task => {
              const overdue = task.deadline && new Date(task.deadline) < new Date()
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${overdue ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}>
                    {overdue ? <AlertTriangle size={15} /> : <Clock size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{task.step_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {task.deadline ? `Due ${new Date(task.deadline).toLocaleDateString()}` : 'No deadline'}
                    </p>
                  </div>
                  <Link to={`/workflows/${task.instance}`} className="shrink-0 text-xs font-medium text-primary-600 hover:underline">
                    Review
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
