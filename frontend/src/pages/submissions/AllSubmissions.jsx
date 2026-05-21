import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { workflowApi } from '../../api'
import { Send, Plus, ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

const STATUS = {
  pending:           { label: 'Pending',           cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  in_progress:       { label: 'In progress',       cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  approved:          { label: 'Approved',          cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  rejected:          { label: 'Rejected',          cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  revision_required: { label: 'Revision required', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  cancelled:         { label: 'Cancelled',         cls: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
}

function StatusBadge({ status }) {
  const s = STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return <span className={clsx('inline-flex px-2 py-0.5 rounded text-[11px] font-semibold', s.cls)}>{s.label}</span>
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[200, 100, 80, 90, 80, 60].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

export default function AllSubmissions() {
  const navigate = useNavigate()
  const [instances, setInstances] = useState([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('')

  useEffect(() => {
    const params = statusFilter ? { status: statusFilter } : {}
    workflowApi.getInstances(params)
      .then(({ data }) => setInstances(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [statusFilter])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center shrink-0">
            <Send size={20} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">All Submissions</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">PSSM approval workflows</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/submissions/new')}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={16} />
          New submission
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[['', 'All'], ...Object.entries(STATUS).map(([v, { label }]) => [v, label])].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatus(val)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              statusFilter === val
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                {['Title', 'Reference', 'Step', 'Status', 'Initiated', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : instances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-400 dark:text-slate-500">
                    No submissions{statusFilter ? ' with this status' : ''}.{' '}
                    <button onClick={() => navigate('/submissions/new')} className="text-primary-600 hover:underline">
                      Start one now
                    </button>
                  </td>
                </tr>
              ) : instances.map(inst => (
                <tr
                  key={inst.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/workflows/${inst.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 max-w-[220px] truncate">
                    {inst.title}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{inst.record_reference || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Step {inst.current_step}</td>
                  <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {inst.initiated_at ? new Date(inst.initiated_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={16} className="text-slate-400 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
