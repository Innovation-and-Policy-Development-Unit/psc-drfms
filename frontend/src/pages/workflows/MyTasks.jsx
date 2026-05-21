import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { workflowApi } from '../../api'
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react'

export default function MyTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    workflowApi.getMyTasks().then(({ data }) => setTasks(data.results || data)).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Pending Tasks</h1>
      {loading ? <div className="skeleton h-40 rounded-xl" /> : tasks.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-400 mb-3" />
          <p className="text-slate-500">No pending tasks. You are all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const overdue = task.deadline && new Date(task.deadline) < new Date()
            return (
              <div key={task.id} className="card p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${overdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {overdue ? <AlertTriangle size={18} /> : <Clock size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{task.step_name}</p>
                  <p className="text-sm text-slate-500">{task.deadline ? `Due: ${new Date(task.deadline).toLocaleDateString()}` : 'No deadline'}</p>
                </div>
                <Link to={`/workflows/${task.instance}`} className="btn-primary btn-sm shrink-0">Review</Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
