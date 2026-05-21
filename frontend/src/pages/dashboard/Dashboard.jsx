import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi, workflowApi } from '../../api'
import { useAuth } from '../../context/AuthContext'
import {
  FolderOpen, Lock, AlertTriangle, Star, GitBranch,
  Clock, CheckCircle, TrendingUp, FileText, ArrowRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts'

function StatCard({ title, value, icon: Icon, color, link, subtitle }) {
  const card = (
    <div className={`card p-5 flex items-start gap-4 ${link ? 'hover:shadow-card-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value ?? '—'}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
  return link ? <Link to={link}>{card}</Link> : card
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [byType, setByType] = useState([])
  const [byMonth, setByMonth] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.getDashboard(),
      analyticsApi.getRecordsByType(),
      analyticsApi.getRecordsByMonth(),
      workflowApi.getMyTasks(),
    ]).then(([s, t, m, tasks]) => {
      setStats(s.data)
      setByType(t.data.map(d => ({ name: d.document_type.replace('_', ' '), count: d.count })))
      setByMonth(m.data.map(d => ({ month: d.month, count: d.count })))
      setMyTasks(tasks.data.results || tasks.data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Good morning, {user?.first_name || 'Officer'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">PSC-DRFMS — Digital Records & File Management System</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Records" value={stats?.total_records} icon={FolderOpen} color="bg-primary-500" link="/records" />
        <StatCard title="On Legal Hold" value={stats?.on_legal_hold} icon={Lock} color="bg-red-500" link="/compliance/legal-holds" subtitle="records frozen" />
        <StatCard title="Overdue" value={stats?.overdue_records} icon={AlertTriangle} color="bg-amber-500" link="/compliance/overdue" subtitle="past retention date" />
        <StatCard title="Vital Records" value={stats?.vital_records} icon={Star} color="bg-emerald-500" link="/records?is_vital=true" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Active Workflows" value={stats?.pending_workflows} icon={GitBranch} color="bg-cyan-500" link="/workflows" />
        <StatCard title="Active Legal Holds" value={stats?.active_legal_holds} icon={Lock} color="bg-purple-500" link="/compliance/legal-holds" />
        <StatCard title="Records This Month" value={stats?.records_this_month} icon={TrendingUp} color="bg-indigo-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Records by month chart */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Records Ingested — Last 12 Months</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="rgb(var(--p-500))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Records by type chart */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Records by Document Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="rgb(var(--p-500))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* My pending tasks */}
      {myTasks.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">My Pending Tasks</h3>
            <Link to="/workflows/my-tasks" className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {myTasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${task.deadline && new Date(task.deadline) < new Date() ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  <Clock size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{task.step_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {task.deadline ? `Due: ${new Date(task.deadline).toLocaleDateString()}` : 'No deadline'}
                  </p>
                </div>
                <Link to={`/workflows/${task.instance}`} className="btn-sm btn-outline shrink-0">
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
