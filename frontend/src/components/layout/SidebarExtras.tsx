import { useCallback, useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Pin, X } from 'lucide-react'
import clsx from 'clsx'
import { driveApi, PINS_CHANGED_EVENT, type PinnedView, type StorageUsage } from '@/api/drive'

/** The user's pinned views, one click away. Pin a view from the toolbar of any file list. */
export function QuickAccess() {
  const [pins, setPins] = useState<PinnedView[]>([])
  const location = useLocation()
  const here = location.pathname + location.search

  const load = useCallback(() => {
    driveApi.pins().then(({ data }) => setPins(data)).catch(() => { /* section stays empty */ })
  }, [])
  useEffect(() => {
    load()
    window.addEventListener(PINS_CHANGED_EVENT, load)
    return () => window.removeEventListener(PINS_CHANGED_EVENT, load)
  }, [load])

  if (pins.length === 0) return null

  const remove = async (pin: PinnedView) => {
    setPins((cur) => cur.filter((p) => p.id !== pin.id))
    try { await driveApi.unpin(pin.id) } catch { load() }
  }

  return (
    <div className="mb-2">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Quick access</div>
      <ul className="space-y-0.5">
        {pins.map((p) => (
          <li key={p.id} className="group relative">
            <NavLink
              to={p.target}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 pe-8 text-sm transition-colors',
                here === p.target
                  ? 'bg-primary-50 font-medium text-primary-500 dark:bg-primary-500/[0.12] dark:text-primary-400'
                  : 'text-slate-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-gray-100',
              )}
            >
              <Pin size={14} className="shrink-0" />
              <span className="truncate">{p.label}</span>
              {!p.own && <span className="ms-auto shrink-0 rounded bg-gray-100 px-1.5 text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:bg-white/10" title={`Shared by ${p.ownerName}`}>shared</span>}
            </NavLink>
            {p.own && <button
              type="button"
              onClick={() => remove(p)}
              aria-label={`Remove ${p.label} from Quick access`}
              className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 opacity-0 hover:bg-gray-200 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-white/10"
            >
              <X size={12} />
            </button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1 }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`
}

/** Storage used by the records you can see, with a bar when a quota is set (STORAGE_QUOTA_GB). */
export function StorageMeter() {
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const location = useLocation()

  // Refresh on navigation: an upload elsewhere changes the number
  useEffect(() => {
    driveApi.storage().then(({ data }) => setUsage(data)).catch(() => setUsage(null))
  }, [location.pathname])

  if (!usage) return null
  const pct = usage.quotaBytes ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : null

  return (
    <div className="px-3 pb-3 pt-1" aria-label="Storage">
      <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Storage</p>
      {pct !== null && (
        <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={clsx('h-full rounded-full', pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-primary-500')} style={{ width: `${Math.max(pct, 1)}%` }} />
        </div>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {formatBytes(usage.usedBytes)} used{usage.quotaBytes ? ` of ${formatBytes(usage.quotaBytes)} (${pct! < 1 ? '<1' : Math.round(pct!)}%)` : ''}
        {' · '}{usage.recordCount.toLocaleString()} {usage.recordCount === 1 ? 'record' : 'records'}
      </p>
    </div>
  )
}
