import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
          'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-start transition-colors',
          selectedId === String(node.id)
            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/60'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
            className="p-0.5"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-5" />
        )}
        <FolderOpen size={15} className="shrink-0 opacity-70" />
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

export default function SeriesSidebar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [series, setSeries] = useState([])
  const selectedId = searchParams.get('record_series') || ''

  useEffect(() => {
    recordsApi.getRecordSeries().then(({ data }) => {
      setSeries(data.results || data)
    }).catch(console.error)
  }, [])

  const roots = series.filter(s => !s.parent)

  const selectSeries = (id) => {
    const p = new URLSearchParams(searchParams)
    if (id) p.set('record_series', id)
    else p.delete('record_series')
    p.set('page', '1')
    setSearchParams(p)
  }

  return (
    <aside className="w-52 shrink-0 border-e border-slate-200 dark:border-slate-700 bg-[#fafafa] dark:bg-slate-900/50 overflow-y-auto custom-scrollbar p-2 hidden md:block">
      <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Libraries</p>
      <button
        type="button"
        onClick={() => selectSeries(null)}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm mb-1',
          !selectedId ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'hover:bg-slate-200/80 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
        )}
      >
        <FolderOpen size={15} />
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
    </aside>
  )
}
