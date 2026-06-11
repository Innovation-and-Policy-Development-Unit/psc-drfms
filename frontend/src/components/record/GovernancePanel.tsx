import { Link } from 'react-router-dom'
import { Lock, Star, Calendar, AlertTriangle, ExternalLink } from 'lucide-react'

export default function GovernancePanel({ record }) {
  const daysToRetention = record.scheduled_destruction_date
    ? Math.ceil((new Date(record.scheduled_destruction_date as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Governance & compliance</h3>

      <div className="grid gap-3">
        {record.is_on_legal_hold && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <Lock size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Legal hold active</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">This document cannot be modified or destroyed.</p>
              <Link to="/compliance/legal-holds" className="text-xs text-red-700 underline mt-2 inline-flex items-center gap-1">
                Manage holds <ExternalLink size={10} />
              </Link>
            </div>
          </div>
        )}

        {record.is_vital && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Star size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Vital record</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Excluded from automated destruction schedules.</p>
            </div>
          </div>
        )}

        {record.scheduled_destruction_date && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Calendar size={18} className="text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Retention countdown</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Scheduled destruction: {new Date(record.scheduled_destruction_date).toLocaleDateString()}
                {daysToRetention != null && (
                  <span className={daysToRetention < 90 ? ' text-amber-600 font-medium' : ''}>
                    {' '}({daysToRetention > 0 ? `${daysToRetention} days remaining` : 'overdue'})
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {record.retention_date && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">Retention date:</span>{' '}
            {new Date(record.retention_date).toLocaleDateString()}
          </div>
        )}

        {record.record_series_name && (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">Classification series:</span> {record.record_series_name}
          </div>
        )}

        <div className="text-sm text-slate-600 dark:text-slate-400 capitalize">
          <span className="font-medium">Classification level:</span> {record.classification_level}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Link to="/compliance/retention" className="btn-sm btn-outline">Retention schedules</Link>
        <Link to="/compliance/overdue" className="btn-sm btn-outline flex items-center gap-1">
          <AlertTriangle size={12} /> Overdue records
        </Link>
      </div>
    </div>
  )
}
