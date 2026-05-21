import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowApi } from '../../api'
import { UserCheck, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import clsx from 'clsx'

function timeLeft(deadline) {
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
  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    workflowApi.getMyTasks()
      .then(({ data }) => setTasks(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const overdueTasks = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date())
  const pendingTasks = tasks.filter(t => !(t.deadline && new Date(t.deadline) < new Date()))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center shrink-0">
          <UserCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My assigned</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Submissions requiring your action
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-14 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="font-medium text-slate-700 dark:text-slate-300">All caught up</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">No submissions are waiting for your action.</p>
        </div>
      ) : (
        <>
          {/* Overdue */}
          {overdueTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={15} className="text-red-500" />
                <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                  Overdue ({overdueTasks.length})
                </h2>
              </div>
              <div className="space-y-2">
                {overdueTasks.map(task => <TaskCard key={task.id} task={task} navigate={navigate} />)}
              </div>
            </section>
          )}

          {/* Pending */}
          {pendingTasks.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={15} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  Pending ({pendingTasks.length})
                </h2>
              </div>
              <div className="space-y-2">
                {pendingTasks.map(task => <TaskCard key={task.id} task={task} navigate={navigate} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function TaskCard({ task, navigate }) {
  const tl = timeLeft(task.deadline)
  const overdue = tl?.overdue

  return (
    <div className={clsx(
      'flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border rounded-xl transition-colors cursor-pointer',
      overdue
        ? 'border-red-200 dark:border-red-800/50 hover:bg-red-50/30 dark:hover:bg-red-900/10'
        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30'
    )}
      onClick={() => navigate(`/workflows/${task.instance}`)}
    >
      <div className={clsx(
        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
        overdue ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
      )}>
        {overdue ? <AlertTriangle size={18} /> : <Clock size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white truncate">{task.step_name}</p>
        {task.instance_title && (
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{task.instance_title}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {tl && (
          <span className={clsx(
            'text-xs font-semibold px-2 py-0.5 rounded-full',
            overdue
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : tl.urgent
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
          )}>
            {tl.label}
          </span>
        )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); navigate(`/workflows/${task.instance}`) }}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
        >
          Review →
        </button>
      </div>
    </div>
  )
}
