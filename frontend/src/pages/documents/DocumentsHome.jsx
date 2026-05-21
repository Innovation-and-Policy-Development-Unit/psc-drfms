import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { recordsApi, workflowApi, notificationsApi } from '../../api'
import FileCard from '../../components/drive/FileCard'
import { Upload, FolderOpen, ArrowRight, CheckCircle, Activity } from 'lucide-react'

export default function DocumentsHome() {
  const { user } = useAuth()
  const [recent, setRecent] = useState([])
  const [tasks, setTasks] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      recordsApi.getRecords({ page_size: 8, ordering: '-updated_at' }),
      workflowApi.getMyTasks(),
      notificationsApi.activity({ limit: 8 }),
    ])
      .then(([rec, t, act]) => {
        setRecent(rec.data.results || rec.data)
        setTasks((t.data.results || t.data).slice(0, 5))
        setActivity(act.data.results || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const firstName = user?.first_name || 'there'

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

      <div className="grid sm:grid-cols-3 gap-3">
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
            <p className="text-xs text-slate-500">{tasks.length} pending task{tasks.length !== 1 ? 's' : ''}</p>
          </div>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
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
              <Link to="/upload" className="btn-primary mt-4 inline-flex">
                <Upload size={16} /> Upload your first file
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {recent.map(r => <FileCard key={r.id} record={r} />)}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity size={18} /> Activity
          </h2>
          {activity.length === 0 ? (
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
    </div>
  )
}
