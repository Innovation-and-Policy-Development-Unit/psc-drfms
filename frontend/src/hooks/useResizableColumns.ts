import { useState, useCallback, useEffect } from 'react'

export interface ColumnWidths {
  type: number
  modified: number
  size: number
}

const DEFAULT: ColumnWidths = { type: 112, modified: 128, size: 72 }
const MIN: ColumnWidths = { type: 64, modified: 88, size: 56 }

const STORAGE_KEY = 'drive-list-columns'

export function useResizableColumns() {
  const [widths, setWidths] = useState<ColumnWidths>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
    } catch { /* ignore */ }
    return DEFAULT
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
  }, [widths])

  const gridTemplate = useCallback((bulk: boolean) => {
    const cols = `${widths.type}px ${widths.modified}px ${widths.size}px`
    return bulk
      ? `32px 40px minmax(180px, 1fr) ${cols}`
      : `40px minmax(180px, 1fr) ${cols}`
  }, [widths])

  const startResize = useCallback((column: keyof ColumnWidths, startX: number) => {
    const startWidth = widths[column]

    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX
      setWidths((prev) => ({
        ...prev,
        [column]: Math.max(MIN[column], startWidth + delta),
      }))
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
  }, [widths])

  return { widths, gridTemplate, startResize }
}
