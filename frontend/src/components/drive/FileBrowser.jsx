import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { recordsApi } from '../../api'
import FileCard, { StarButton } from './FileCard'
import { getFileTypeInfo, formatFileSize } from '../../utils/fileType'
import clsx from 'clsx'
import {
  LayoutGrid, List, Upload, ChevronLeft, ChevronRight, FolderOpen, CheckSquare, Square, Download
} from 'lucide-react'
import { Lock, Star, Eye } from 'lucide-react'

export default function FileBrowser({
  title, subtitle, defaultOrdering = '-updated_at', pageSize = 24,
  enableBulk = false, filterParams = {}, showStarToggle = false,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [records, setRecords] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(() => localStorage.getItem('drive-view') || 'grid')
  const [selected, setSelected] = useState(new Set())
  const [seriesList, setSeriesList] = useState([])
  const [bulkSeries, setBulkSeries] = useState('')
  const [bulkTag, setBulkTag] = useState('')

  const page = parseInt(searchParams.get('page') || '1', 10)
  const ordering = searchParams.get('ordering') || defaultOrdering

  const refreshList = () => {
    setLoading(true)
    const params = { page, page_size: pageSize, ordering }
    if (!filterParams.starred && !filterParams.shared_with_me) {
      const series = searchParams.get('record_series')
      const docType = searchParams.get('document_type')
      if (series) params.record_series = series
      if (docType) params.document_type = docType
    }
    Object.entries(filterParams).forEach(([k, v]) => { if (v) params[k] = v })

    return recordsApi.getRecords(params)
      .then(({ data }) => {
        setRecords(data.results || data)
        setCount(data.count ?? (data.results || data).length)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refreshList()
  }, [page, ordering, searchParams, pageSize, defaultOrdering, JSON.stringify(filterParams)])

  const handleStarChange = (recordId, starred) => {
    setRecords(prev => prev.map(r => r.id === recordId ? { ...r, is_starred: starred } : r))
  }

  const setViewMode = (mode) => {
    setView(mode)
    localStorage.setItem('drive-view', mode)
  }

  useEffect(() => {
    if (enableBulk) {
      recordsApi.getRecordSeries().then(({ data }) => setSeriesList(data.results || data)).catch(() => {})
    }
  }, [enableBulk])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === records.length) setSelected(new Set())
    else setSelected(new Set(records.map(r => r.id)))
  }

  const handleBulkMove = async () => {
    if (!selected.size || !bulkSeries) return
    await recordsApi.bulkUpdateRecords({
      record_ids: [...selected],
      record_series: bulkSeries,
    })
    setSelected(new Set())
    setBulkSeries('')
    refreshList()
  }

  const handleBulkTag = async () => {
    if (!selected.size || !bulkTag.trim()) return
    await recordsApi.bulkUpdateRecords({
      record_ids: [...selected],
      add_tags: [bulkTag.trim()],
    })
    setBulkTag('')
    refreshList()
  }

  const exportCsv = () => {
    const rows = records.filter(r => selected.size === 0 || selected.has(r.id))
    const header = 'reference,title,file_name,updated_at\n'
    const body = rows.map(r =>
      [r.reference_number, r.title, r.file_name, r.updated_at].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'documents-export.csv'
    a.click()
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  return (
    <div className="flex flex-col h-full">
      {enableBulk && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
          <span className="text-sm font-medium text-primary-800 dark:text-primary-200">{selected.size} selected</span>
          <select className="input w-auto text-sm h-8" value={bulkSeries} onChange={e => setBulkSeries(e.target.value)}>
            <option value="">Move to library…</option>
            {seriesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="button" onClick={handleBulkMove} disabled={!bulkSeries} className="btn-sm btn-primary">Move</button>
          <input
            type="text"
            className="input w-32 text-sm h-8"
            placeholder="Add tag…"
            value={bulkTag}
            onChange={e => setBulkTag(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleBulkTag()}
          />
          <button type="button" onClick={handleBulkTag} disabled={!bulkTag.trim()} className="btn-sm btn-outline">Tag</button>
          <button type="button" onClick={exportCsv} className="btn-sm btn-outline"><Download size={14} /> Export</button>
          <button type="button" onClick={() => setSelected(new Set())} className="btn-sm btn-ghost">Clear</button>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 text-sm rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2"
            value={ordering}
            onChange={e => {
              const p = new URLSearchParams(searchParams)
              p.set('ordering', e.target.value)
              p.set('page', '1')
              setSearchParams(p)
            }}
          >
            <option value="-updated_at">Date modified</option>
            <option value="-created_at">Date created</option>
            <option value="title">Name</option>
            <option value="-document_date">Document date</option>
          </select>
          <div className="flex rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={clsx('p-2', view === 'grid' ? 'bg-slate-200 dark:bg-slate-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700')}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={clsx('p-2', view === 'list' ? 'bg-slate-200 dark:bg-slate-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700')}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
          <Link
            to="/upload"
            className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium"
          >
            <Upload size={16} />
            Upload
          </Link>
        </div>
      </div>

      {loading ? (
        <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-2'}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className={view === 'grid' ? 'aspect-[4/3] skeleton rounded-lg' : 'h-12 skeleton rounded-lg'} />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">This folder is empty</p>
          <p className="text-sm text-slate-500 mt-1 mb-6">Upload a document to get started</p>
          <Link to="/upload" className="btn-primary">
            <Upload size={16} /> Upload
          </Link>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {records.map(r => (
            <div key={r.id} className="relative">
              {enableBulk && (
                <button
                  type="button"
                  onClick={() => toggleSelect(r.id)}
                  className="absolute top-2 start-2 z-10 p-1 rounded bg-white/90 dark:bg-slate-800/90 shadow"
                >
                  {selected.has(r.id) ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-slate-400" />}
                </button>
              )}
              <FileCard record={r} showStarToggle={showStarToggle} onStarChange={handleStarChange} />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-left">
              <tr>
                {enableBulk && (
                  <th className="px-2 py-2.5 w-10">
                    <button type="button" onClick={toggleAll}><Square size={16} /></button>
                  </th>
                )}
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium hidden md:table-cell">Modified</th>
                <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Size</th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {records.map(record => {
                const { Icon, color } = getFileTypeInfo(record.mime_type, record.file_name)
                return (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    {enableBulk && (
                      <td className="px-2">
                        <button type="button" onClick={() => toggleSelect(record.id)}>
                          {selected.has(record.id) ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Link to={`/document/${record.id}`} className="flex items-center gap-3 min-w-0">
                        <div className={clsx('w-8 h-8 rounded flex items-center justify-center text-white shrink-0', color)}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate">{record.title}</p>
                          <p className="text-xs text-slate-500 truncate">{record.file_name || record.reference_number}</p>
                        </div>
                        {showStarToggle && (
                          <StarButton record={record} onChange={handleStarChange} />
                        )}
                        {record.is_vital && <Star size={12} className="text-amber-500 fill-amber-500 shrink-0" />}
                        {record.is_on_legal_hold && <Lock size={12} className="text-red-500 shrink-0" />}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">
                      {record.updated_at ? new Date(record.updated_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 hidden lg:table-cell">{formatFileSize(record.file_size)}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/document/${record.id}`} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">{count} items</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('page', String(page - 1)); return n })}
              className="btn-sm btn-outline"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-400 px-2">{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setSearchParams(p => { const n = new URLSearchParams(p); n.set('page', String(page + 1)); return n })}
              className="btn-sm btn-outline"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
