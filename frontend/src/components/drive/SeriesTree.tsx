import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Folder, ChevronRight, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { recordsApi } from '@/api'
import type { RecordSeries } from '@/types/api'

interface SeriesNodeProps {
  node: RecordSeries
  all: RecordSeries[]
  depth: number
  selectedId: string
  onSelect: (id: number | null) => void
  collapsed?: boolean
}

function SeriesNode({ node, all, depth, selectedId, onSelect, collapsed }: SeriesNodeProps) {
  const children = all.filter((s) => s.parent === node.id)
  const [open, setOpen] = useState(depth < 1)
  const hasChildren = children.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={clsx('drive-tree-item', selectedId === String(node.id) && 'active')}
        style={{ paddingLeft: collapsed ? undefined : `${8 + depth * 12}px` }}
        title={node.name}
      >
        {hasChildren && !collapsed ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
            onKeyDown={(e) => e.key === 'Enter' && setOpen((o) => !o)}
            className="p-0.5 shrink-0"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className={clsx('shrink-0', collapsed ? 'w-0' : 'w-4')} />
        )}
        <Folder size={14} className="shrink-0 opacity-70" />
        <span className="drive-tree-label truncate">{node.name}</span>
      </button>
      {open && !collapsed && children.map((child) => (
        <SeriesNode
          key={child.id}
          node={child}
          all={all}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

interface SeriesTreeProps {
  onNavigate?: () => void
  collapsed?: boolean
}

export default function SeriesTree({ onNavigate, collapsed }: SeriesTreeProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [series, setSeries] = useState<RecordSeries[]>([])
  const selectedId = location.pathname === '/browse' ? (searchParams.get('record_series') || '') : ''

  useEffect(() => {
    recordsApi.getRecordSeries()
      .then(({ data }) => {
        const list = 'results' in data && data.results ? data.results : (data as RecordSeries[])
        setSeries(list)
      })
      .catch(() => {})
  }, [])

  const roots = series.filter((s) => !s.parent)

  const selectSeries = (id: number | null) => {
    onNavigate?.()
    if (id) {
      navigate(`/browse?record_series=${id}&page=1`)
    } else {
      navigate('/browse?page=1')
    }
  }

  if (collapsed) return null

  return (
    <div className="px-2 pb-2 pt-2">
      <p className="drive-tree-label px-2 py-1 label-overline">Record series</p>
      <button
        type="button"
        onClick={() => selectSeries(null)}
        className={clsx(
          'drive-tree-item w-full',
          !selectedId && location.pathname === '/browse' && 'active',
        )}
      >
        <span className="w-4 shrink-0" />
        <Folder size={14} className="shrink-0 opacity-70" />
        <span className="drive-tree-label truncate">All documents</span>
      </button>
      {roots.map((root) => (
        <SeriesNode
          key={root.id}
          node={root}
          all={series}
          depth={0}
          selectedId={selectedId}
          onSelect={selectSeries}
        />
      ))}
    </div>
  )
}
