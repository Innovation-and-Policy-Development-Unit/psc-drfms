import { memo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, LayoutGrid, List, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { useDriveUI, type DriveViewMode } from '@/context/DriveUIContext'
import type { BreadcrumbItem } from '@/types/api'

interface DriveToolbarProps {
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  sortValue?: string
  sortOptions?: { value: string; label: string }[]
  onSortChange?: (value: string) => void
  onRefresh?: () => void
  showViewToggle?: boolean
}

function DriveToolbarComponent({
  breadcrumbs = [],
  actions,
  sortValue,
  sortOptions,
  onSortChange,
  onRefresh,
  showViewToggle = true,
}: DriveToolbarProps) {
  const { viewMode, setViewMode } = useDriveUI()

  return (
    <div className="drive-toolbar">
      <nav className="drive-toolbar-path" aria-label="Location">
        <Link to="/" className="hover:text-[var(--text-primary)] shrink-0">Cloud drive</Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            <ChevronRight size={14} className="shrink-0 opacity-50" />
            {crumb.to ? (
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
        {sortOptions && onSortChange && (
          <select
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="input h-8 text-xs w-auto py-1"
            aria-label="Sort records"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}

        {onRefresh && (
          <button type="button" onClick={onRefresh} className="btn-ghost btn-sm p-2" aria-label="Refresh">
            <RefreshCw size={15} />
          </button>
        )}

        {showViewToggle && (
          <div className="drive-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={clsx(viewMode === 'list' && 'active')}
              onClick={() => setViewMode('list' satisfies DriveViewMode)}
              aria-pressed={viewMode === 'list'}
              title="List view"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              className={clsx(viewMode === 'grid' && 'active')}
              onClick={() => setViewMode('grid' satisfies DriveViewMode)}
              aria-pressed={viewMode === 'grid'}
              title="Grid view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        )}

        {actions}
      </div>
    </div>
  )
}

export const DriveToolbar = memo(DriveToolbarComponent)
