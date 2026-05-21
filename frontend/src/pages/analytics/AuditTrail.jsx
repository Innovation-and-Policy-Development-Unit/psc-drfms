import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { auditApi } from '../../api'
import clsx from 'clsx'
import {
  ScrollText, Search, ExternalLink,
  ChevronLeft, ChevronRight, Download, Loader2,
} from 'lucide-react'

// ── Action metadata ──────────────────────────────────────────────────────────
const ACTION_META = {
  view:             { label: 'View',              color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  create:           { label: 'Create',            color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  update:           { label: 'Update',            color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  delete:           { label: 'Delete',            color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  download:         { label: 'Download',          color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
  upload_version:   { label: 'Upload version',    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  approve:          { label: 'Approve',           color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  reject:           { label: 'Reject',            color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  share:            { label: 'Share',             color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  share_access:     { label: 'Link accessed',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  sign:             { label: 'Signed',            color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  legal_hold:       { label: 'Legal hold',        color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  legal_hold_lift:  { label: 'Hold lifted',       color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  destroy:          { label: 'Destroyed',         color: 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300' },
  custody_transfer: { label: 'Custody transfer',  color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' },
  login:            { label: 'Login',             color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  logout:           { label: 'Logout',            color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  login_failed:     { label: 'Login failed',      color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  export:           { label: 'Export',            color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400' },
}

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  ...Object.entries(ACTION_META).map(([value, { label }]) => ({ value, label })),
]

const PAGE_SIZE = 25

function ActionBadge({ action }) {
  const meta = ACTION_META[action] ?? { label: action, color: 'bg-slate-100 text-slate-600' }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap', meta.color)}>
      {meta.label}
    </span>
  )
}

function formatTimestamp(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[140, 100, 80, 120, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

export default function AuditTrail() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (action)   params.action    = action
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo
      if (search)   params.search    = search
      const { data } = await auditApi.getLogs(params)
      const results = Array.isArray(data) ? data : (data.results ?? [])
      setLogs(results)
      setCount(data.count ?? results.length)
    } catch {
      // keep stale results
    } finally {
      setLoading(false)
    }
  }, [page, action, dateFrom, dateTo, search])

  useEffect(() => { load() }, [load])

  const applySearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const clearFilters = () => {
    setAction(''); setDateFrom(''); setDateTo('')
    setSearch(''); setSearchInput(''); setPage(1)
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const hasFilters = action || dateFrom || dateTo || search

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = { page_size: 5000 }
      if (action)   params.action    = action
      if (dateFrom) params.date_from = dateFrom
      if (dateTo)   params.date_to   = dateTo
      if (search)   params.search    = search
      const { data } = await auditApi.getLogs(params)
      const rows = Array.isArray(data) ? data : (data.results ?? [])
      const header = ['Timestamp', 'Actor', 'Email', 'Action', 'Record', 'IP Address']
      const csv = [
        header.join(','),
        ...rows.map(r => [
          formatTimestamp(r.timestamp),
          r.user_name  || '',
          r.user_email || '',
          r.action     || '',
          r.record_reference || r.record || '',
          r.ip_address || '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silently fail — user can retry
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center shrink-0">
            <ScrollText size={20} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit log</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Full record of every action performed in the system
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 shrink-0">
          {count > 0 && (
            <span className="text-sm text-slate-400 dark:text-slate-500">
              {count.toLocaleString()} entries
            </span>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            {exporting
              ? <Loader2 size={14} className="animate-spin" />
              : <Download size={14} />
            }
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Action type */}
          <div className="flex-none">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Action</label>
            <select
              value={action}
              onChange={e => { setAction(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            >
              {ACTION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="flex-none">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {/* Date to */}
          <div className="flex-none">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {/* Search */}
          <form onSubmit={applySearch} className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Email, reference, IP…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </form>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 px-3 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors self-end"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Record
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  IP address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-slate-400 dark:text-slate-500">
                    {hasFilters ? 'No entries match the current filters.' : 'No audit entries yet.'}
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr
                  key={log.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  {/* Timestamp */}
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-xs">
                    {formatTimestamp(log.timestamp)}
                  </td>

                  {/* Actor */}
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                      {log.user_name || log.user_email || '—'}
                    </div>
                    {log.user_name && log.user_email && (
                      <div className="text-xs text-slate-400 truncate max-w-[160px]">{log.user_email}</div>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ActionBadge action={log.action} />
                  </td>

                  {/* Record */}
                  <td className="px-4 py-3">
                    {log.record ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/document/${log.record}`)}
                        className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium truncate max-w-[200px]"
                      >
                        <span className="truncate">{log.record_reference || log.record}</span>
                        <ExternalLink size={12} className="shrink-0" />
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">
                        {log.record_reference || '—'}
                      </span>
                    )}
                  </td>

                  {/* IP */}
                  <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {log.ip_address || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages} &nbsp;·&nbsp; {count.toLocaleString()} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} className="text-slate-500" />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight size={16} className="text-slate-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
