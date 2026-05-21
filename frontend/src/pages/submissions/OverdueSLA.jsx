import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowApi } from '../../api'
import { AlertTriangle, Clock, ChevronRight, CheckCircle } from 'lucide-react'
import clsx from 'clsx'

const SLA_DAYS = 21 // PSSM statutory 21-day review period

function slaStatus(initiatedAt, status) {
  if (!initiatedAt) return null
  if (['approved', 'rejected', 'cancelled'].includes(status)) return null
  const ageMs  = Date.now() - new Date(initiatedAt).getTime()
  const ageDays = Math.floor(ageMs / 86400000)
  const remaining = SLA_DAYS - ageDays

  if (remaining < 0)  return { remaining, label: `${Math.abs(remaining)}d overdue`,  cls: 'text-red-600 dark:text-red-400', barCls: 'bg-red-500', pct: 100 }
  if (remaining <= 3) return { remaining, label: `${remaining}d left`,               cls: 'text-amber-600 dark:text-amber-400', barCls: 'bg-amber-500', pct: Math.round((ageDays / SLA_DAYS) * 100) }
  return { remaining, label: `${remaining}d left`, cls: 'text-slate-500 dark:text-slate-400', barCls: 'bg-emerald-500', pct: Math.round((ageDays / SLA_DAYS) * 100) }
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[200, 100, 90, 120, 100].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

export default function OverdueSLA() {
  const navigate  = useNavigate()
  const [all, setAll]       = useState([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    workflowApi.getInstances({ status: 'in_progress', page_size: 200 })
      .then(({ data }) => setAll(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Annotate with SLA info and sort: most overdue first
  const annotated = all
    .map(inst => ({ ...inst, sla: slaStatus(inst.initiated_at, inst.status) }))
    .filter(inst => inst.sla)
    .sort((a, b) => a.sla.remaining - b.sla.remaining)

  const overdue  = annotated.filter(i => i.sla.remaining < 0)
  const warning  = annotated.filter(i => i.sla.remaining >= 0 && i.sla.remaining <= 3)
  const onTrack  = annotated.filter(i => i.sla.remaining > 3)
  const displayed = showAll ? annotated : annotated.filter(i => i.sla.remaining <= 3)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center shrink-0">
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overdue / SLA</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            PSSM 21-day statutory review tracking
          </p>
        </div>
      </div>

      {/* Summary chips */}
      {!loading && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
            <AlertTriangle size={14} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">{overdue.length} overdue</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
            <Clock size={14} className="text-amber-500" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{warning.length} due within 3 days</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg">
            <CheckCircle size={14} className="text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{onTrack.length} on track</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                {['Submission', 'Reference', 'Status', 'SLA progress', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-slate-400 dark:text-slate-500">
                    <CheckCircle size={32} className="mx-auto text-emerald-400 mb-2" />
                    No active submissions are overdue or at risk.
                  </td>
                </tr>
              ) : displayed.map(inst => {
                const { sla } = inst
                return (
                  <tr
                    key={inst.id}
                    className={clsx(
                      'cursor-pointer transition-colors',
                      sla.remaining < 0
                        ? 'bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : sla.remaining <= 3
                          ? 'bg-amber-50/20 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/15'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    )}
                    onClick={() => navigate(`/workflows/${inst.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 max-w-[200px] truncate">
                      {inst.title}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{inst.record_reference || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Step {inst.current_step}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className={clsx('text-xs font-semibold', sla.cls)}>{sla.label}</span>
                          <span className="text-xs text-slate-400">{SLA_DAYS}d SLA</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full transition-all', sla.barCls)}
                            style={{ width: `${Math.min(sla.pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={16} className="text-slate-400 inline" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!loading && onTrack.length > 0 && !showAll && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 text-center">
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Show {onTrack.length} on-track submission{onTrack.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
