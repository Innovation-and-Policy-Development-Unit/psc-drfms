import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { FolderOpen, ChevronRight, ChevronDown } from 'lucide-react'
import { recordsApi } from '../../api'

function SeriesNode({ node, all, depth, selectedId, onSelect }) {
  const children = all.filter(s => s.parent === node.id)
  const [open, setOpen] = useState(depth < 1)
  const hasChildren = children.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={clsx(
          'w-full flex items-center gap-1 px-2 py-1 rounded-md text-xs text-start transition-colors',
          selectedId === String(node.id)
            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
        )}
        style={{ paddingLeft: `${6 + depth * 10}px` }}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
            className="p-0.5 shrink-0"
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <FolderOpen size={13} className="shrink-0 opacity-70" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && children.map(child => (
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

export default function SeriesTree({ onNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [series, setSeries] = useState([])
  const selectedId = location.pathname === '/browse' ? (searchParams.get('record_series') || '') : ''

  useEffect(() => {
    recordsApi.getRecordSeries()
      .then(({ data }) => setSeries(data.results || data))
      .catch(console.error)
  }, [])

  const roots = series.filter(s => !s.parent)

  const selectSeries = (id) => {
    onNavigate?.()
    if (id) {
      navigate(`/browse?record_series=${id}&page=1`)
    } else {
      navigate('/browse?page=1')
    }
  }

  return (
    <div className="px-2 pb-2">
      <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Libraries
      </p>
      <button
        type="button"
        onClick={() => selectSeries(null)}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs mb-0.5',
          !selectedId && location.pathname === '/browse'
            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
        )}
      >
        <FolderOpen size={13} />
        All documents
      </button>
      {roots.map(root => (
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
