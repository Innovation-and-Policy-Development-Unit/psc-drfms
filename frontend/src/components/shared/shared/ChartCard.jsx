import { MoreHorizontal } from 'lucide-react'

export default function ChartCard({ title, subtitle, children, action, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
