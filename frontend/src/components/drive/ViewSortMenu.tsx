import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, LayoutGrid, List, PanelRight, Rows3, SlidersHorizontal } from 'lucide-react'
import clsx from 'clsx'
import { useDriveUI, type DriveViewMode } from '@/context/DriveUIContext'
import { useDriveListColumns } from '@/context/ResizableColumnsContext'
import { COLUMNS } from '@/hooks/useResizableColumns'
import { GROUP_OPTIONS } from '@/lib/recordGroups'

export interface SortField {
  field: string
  label: string
  /** Direction used the first time this field is chosen: dates and sizes read best newest/largest first. */
  startDesc?: boolean
}

export const SORT_FIELDS: SortField[] = [
  { field: 'title', label: 'Name' },
  { field: 'reference_number', label: 'Reference' },
  { field: 'document_type', label: 'Record type' },
  { field: 'classification_rank', label: 'Classification' },
  { field: 'retention_date', label: 'Retention ends', startDesc: false },
  { field: 'updated_at', label: 'Modified', startDesc: true },
  { field: 'created_at', label: 'Date added', startDesc: true },
  { field: 'file_size', label: 'File size', startDesc: true },
]

const VIEWS: Array<{ mode: DriveViewMode; label: string; Icon: typeof List }> = [
  { mode: 'list', label: 'List', Icon: List },
  { mode: 'compact', label: 'Compact list', Icon: Rows3 },
  { mode: 'grid', label: 'Tiles', Icon: LayoutGrid },
]

interface Props {
  ordering: string
  onOrderingChange: (value: string) => void
  /** Active grouping (see GROUP_OPTIONS) or '' for none. */
  group?: string
  onGroupChange?: (value: string) => void
}

/** One menu for how the list looks: view style, sort field and direction, which columns show. */
export function ViewSortMenu({ ordering, onOrderingChange, group = '', onGroupChange }: Props) {
  const { viewMode, setViewMode, infoPaneOpen, toggleInfoPane } = useDriveUI()
  const { visibleKeys, toggleColumn, resetColumns } = useDriveListColumns()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const field = ordering.replace(/^-/, '')
  const desc = ordering.startsWith('-')
  const ActiveView = VIEWS.find((v) => v.mode === viewMode)?.Icon ?? List

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const chooseSort = (f: SortField) => {
    if (f.field === field) onOrderingChange(desc ? f.field : `-${f.field}`)
    else onOrderingChange(f.startDesc ? `-${f.field}` : f.field)
  }

  return (
    <div className="flex items-center gap-1.5">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="btn-ghost btn-sm flex items-center gap-1.5 px-2.5"
          title="View, sort and columns"
        >
          <ActiveView size={15} /> <SlidersHorizontal size={14} className="opacity-60" />
          <span className="sr-only">View and sort options</span>
        </button>

        {open && (
          <div role="menu" className="absolute end-0 top-full z-40 mt-1 w-60 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] py-1 text-sm shadow-lg">
            {VIEWS.map(({ mode, label, Icon }) => (
              <button key={mode} type="button" role="menuitemradio" aria-checked={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={clsx('flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-[var(--surface-sunken)]', viewMode === mode && 'font-semibold text-[var(--text-primary)]')}>
                <Icon size={15} className="shrink-0" /> <span className="flex-1">{label}</span>
                {viewMode === mode && <Check size={14} />}
              </button>
            ))}

            <div className="my-1 border-t border-[var(--border-default)]" />
            {onGroupChange && (
              <>
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Group by</p>
                {[{ value: '', label: 'No grouping' }, ...GROUP_OPTIONS].map((g) => (
                  <button key={g.value} type="button" role="menuitemradio" aria-checked={group === g.value}
                    onClick={() => onGroupChange(g.value)}
                    className={clsx('flex w-full items-center gap-2.5 px-3 py-1.5 text-start hover:bg-[var(--surface-sunken)]', group === g.value && 'font-semibold text-[var(--text-primary)]')}>
                    <span className="flex w-4 justify-center">{group === g.value && <Check size={14} />}</span>
                    <span className="flex-1">{g.label}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-[var(--border-default)]" />
              </>
            )}
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{group ? 'Sort within groups by' : 'Sort by'}</p>
            {SORT_FIELDS.map((f) => (
              <button key={f.field} type="button" role="menuitemradio" aria-checked={f.field === field}
                onClick={() => chooseSort(f)}
                className={clsx('flex w-full items-center gap-2.5 px-3 py-1.5 text-start hover:bg-[var(--surface-sunken)]', f.field === field && 'font-semibold text-[var(--text-primary)]')}>
                <span className="flex w-4 justify-center">{f.field === field && (desc ? <ArrowDown size={14} /> : <ArrowUp size={14} />)}</span>
                <span className="flex-1">{f.label}</span>
              </button>
            ))}

            {viewMode !== 'grid' && (
              <>
                <div className="my-1 border-t border-[var(--border-default)]" />
                <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Columns</p>
                  <button type="button" onClick={resetColumns} className="text-[11px] text-[var(--brand-primary)] hover:underline">Reset</button>
                </div>
                {COLUMNS.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--surface-sunken)]">
                    <input type="checkbox" className="rounded-sm" checked={visibleKeys.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={toggleInfoPane}
        aria-pressed={infoPaneOpen}
        title="Details pane (I)"
        className={clsx('btn-ghost btn-sm hidden items-center gap-1.5 px-2.5 lg:flex', infoPaneOpen && 'bg-[var(--surface-sunken)]')}
      >
        <PanelRight size={15} /> Details
      </button>
    </div>
  )
}
