import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import type { BreadcrumbItem } from '@/types/api'

interface DriveToolbarProps {
  breadcrumbs?: BreadcrumbItem[]
  /** Primary actions on the right, e.g. the New menu. */
  actions?: ReactNode
  /** View, sort and details controls. */
  viewControl?: ReactNode
  onRefresh?: () => void
}

/** A crumb with a dropdown of its siblings, so you can hop sideways without going up first. */
function CrumbMenu({ crumb }: { crumb: BreadcrumbItem }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <span ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--surface-sunken)]"
      >
        <strong className="truncate">{crumb.label}</strong>
        <ChevronDown size={14} className="shrink-0 opacity-60" />
      </button>
      {open && (
        <div role="menu" className="absolute start-0 top-full z-40 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] py-1 shadow-lg">
          {crumb.siblings!.map((s) => (
            <Link
              key={s.to + s.label}
              to={s.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={clsx('flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-sunken)]', s.current && 'font-semibold text-[var(--text-primary)]')}
            >
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              {s.current && <Check size={14} className="shrink-0" />}
            </Link>
          ))}
        </div>
      )}
    </span>
  )
}

function DriveToolbarComponent({ breadcrumbs = [], actions, viewControl, onRefresh }: DriveToolbarProps) {
  return (
    <div className="drive-toolbar">
      <nav className="drive-toolbar-path" aria-label="Location">
        <Link to="/" className="hover:text-[var(--text-primary)] shrink-0">Cloud drive</Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            <ChevronRight size={14} className="shrink-0 opacity-50" />
            {crumb.siblings?.length ? (
              <CrumbMenu crumb={crumb} />
            ) : crumb.to ? (
              <Link to={crumb.to} className="hover:text-[var(--text-primary)] truncate">
                {crumb.label}
              </Link>
            ) : (
              <strong className="truncate">{crumb.label}</strong>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2 shrink-0 ms-auto">
        {onRefresh && (
          <button type="button" onClick={onRefresh} className="btn-ghost btn-sm p-2" aria-label="Refresh">
            <RefreshCw size={15} />
          </button>
        )}
        {viewControl}
        {actions}
      </div>
    </div>
  )
}

export const DriveToolbar = memo(DriveToolbarComponent)
