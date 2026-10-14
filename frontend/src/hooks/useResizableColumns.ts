import { useState, useCallback, useEffect, useMemo } from 'react'

/** Optional columns of the file list, left to right. Name is always shown. */
export type ColumnKey = 'type' | 'classification' | 'retention' | 'status' | 'modified' | 'size' | 'sharing'

export interface ColumnDef {
  key: ColumnKey
  label: string
  /** API ordering field when the header is clicked; undefined = not sortable */
  sort?: string
  width: number
  min: number
  align?: 'end'
}

export const COLUMNS: ColumnDef[] = [
  { key: 'type', label: 'File type', width: 96, min: 64 },
  { key: 'classification', label: 'Classification', sort: 'classification_rank', width: 120, min: 90 },
  { key: 'retention', label: 'Retention ends', sort: 'retention_date', width: 128, min: 96 },
  { key: 'status', label: 'Status', width: 112, min: 80 },
  { key: 'modified', label: 'Modified', sort: 'updated_at', width: 112, min: 88 },
  { key: 'size', label: 'Size', sort: 'file_size', width: 80, min: 56, align: 'end' },
  { key: 'sharing', label: 'Sharing', width: 88, min: 64 },
]

const DEFAULT_VISIBLE: ColumnKey[] = ['classification', 'retention', 'modified', 'size', 'sharing']
const STORAGE_KEY = 'drive-list-columns-v2'

interface Stored { widths: Partial<Record<ColumnKey, number>>; visible: ColumnKey[] }

function load(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Stored | null
    if (raw && Array.isArray(raw.visible)) {
      return { widths: raw.widths ?? {}, visible: raw.visible.filter((k) => COLUMNS.some((c) => c.key === k)) }
    }
  } catch { /* storage blocked or corrupt: use defaults */ }
  return { widths: {}, visible: DEFAULT_VISIBLE }
}

export function useResizableColumns() {
  const [state, setState] = useState<Stored>(load)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* per-visit only */ }
  }, [state])

  const visibleColumns = useMemo(
    () => COLUMNS.filter((c) => state.visible.includes(c.key)).map((c) => ({ ...c, width: state.widths[c.key] ?? c.width })),
    [state],
  )

  const gridTemplate = useCallback((bulk: boolean) => {
    const cols = visibleColumns.map((c) => `${c.width}px`).join(' ')
    const lead = bulk ? '32px 40px' : '40px'
    return `${lead} minmax(180px, 1fr)${cols ? ` ${cols}` : ''}`
  }, [visibleColumns])

  const startResize = useCallback((key: ColumnKey, startX: number) => {
    const def = COLUMNS.find((c) => c.key === key)
    if (!def) return
    const startWidth = state.widths[key] ?? def.width
    const rtl = document.documentElement.dir === 'rtl'

    const onMove = (e: MouseEvent) => {
      const delta = (rtl ? -1 : 1) * (e.clientX - startX)
      setState((prev) => ({ ...prev, widths: { ...prev.widths, [key]: Math.max(def.min, startWidth + delta) } }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [state.widths])

  const toggleColumn = useCallback((key: ColumnKey) => {
    setState((prev) => ({
      ...prev,
      visible: prev.visible.includes(key) ? prev.visible.filter((k) => k !== key) : [...prev.visible, key],
    }))
  }, [])

  const resetColumns = useCallback(() => setState({ widths: {}, visible: DEFAULT_VISIBLE }), [])

  return { visibleColumns, visibleKeys: state.visible, gridTemplate, startResize, toggleColumn, resetColumns }
}
