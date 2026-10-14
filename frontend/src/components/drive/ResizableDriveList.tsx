import { memo } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import clsx from 'clsx'
import { useDriveListColumns } from '@/context/ResizableColumnsContext'

interface ResizableDriveListHeaderProps {
  enableBulk?: boolean
  allSelected?: boolean
  someSelected?: boolean
  onToggleAll?: () => void
  /** Current API ordering, e.g. "-updated_at"; clicking a sortable header calls onSort with its field. */
  ordering?: string
  onSort?: (field: string) => void
}

function SortMark({ field, ordering }: { field: string; ordering?: string }) {
  if (!ordering || ordering.replace(/^-/, '') !== field) return null
  return ordering.startsWith('-') ? <ArrowDown size={11} aria-hidden /> : <ArrowUp size={11} aria-hidden />
}

function ResizableDriveListHeaderComponent({
  enableBulk = false,
  allSelected = false,
  someSelected = false,
  onToggleAll,
  ordering,
  onSort,
}: ResizableDriveListHeaderProps) {
  const { gridTemplate, startResize, visibleColumns } = useDriveListColumns()

  const sortable = (field: string, label: string, align?: 'end') => (
    <button
      type="button"
      onClick={() => onSort?.(field)}
      className={clsx(
        'inline-flex max-w-full items-center gap-1 truncate uppercase hover:text-[var(--text-primary)]',
        align === 'end' && 'ms-auto',
        ordering?.replace(/^-/, '') === field && 'text-[var(--text-primary)]',
      )}
      aria-label={`Sort by ${label}`}
    >
      <span className="truncate">{label}</span>
      <SortMark field={field} ordering={ordering} />
    </button>
  )

  return (
    <div
      className={clsx('drive-files-header', enableBulk && 'bulk')}
      style={{ gridTemplateColumns: gridTemplate(enableBulk) }}
    >
      {enableBulk && (
        <span className="flex items-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
            onChange={onToggleAll}
            aria-label="Select all"
            className="rounded-sm border-registry"
          />
        </span>
      )}
      <span />
      <span className="drive-col-header">{sortable('title', 'Name')}</span>
      {visibleColumns.map((c) => (
        <span key={c.key} className={clsx('drive-col-header relative flex', c.align === 'end' && 'justify-end text-end')}>
          {c.sort ? sortable(c.sort, c.label, c.align) : <span className="truncate">{c.label}</span>}
          <span
            className="drive-col-resize"
            onMouseDown={(e) => startResize(c.key, e.clientX)}
            role="separator"
            aria-orientation="vertical"
          />
        </span>
      ))}
    </div>
  )
}

export const ResizableDriveListHeader = memo(ResizableDriveListHeaderComponent)
