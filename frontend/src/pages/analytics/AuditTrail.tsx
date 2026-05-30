import { useState, useEffect, useCallback, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { auditApi, unwrapList } from '@/api'
import type { AuditLogEntry } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { AuditActionBadge, AUDIT_ACTION_FILTER_OPTIONS } from '@/lib/auditActions'

const PAGE_SIZE = 25

function formatTimestamp(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AuditTrail() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
      if (action) params.action = action
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (search) params.search = search
      const { data } = await auditApi.getLogs(params)
      const results = unwrapList<AuditLogEntry>(data)
      setLogs(results)
      setCount((data as { count?: number }).count ?? results.length)
    } catch {
      // keep stale results
    } finally {
      setLoading(false)
    }
  }, [page, action, dateFrom, dateTo, search])

  useEffect(() => { load() }, [load])

  const applySearch = (e: FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const clearFilters = () => {
    setAction('')
    setDateFrom('')
    setDateTo('')
    setSearch('')
    setSearchInput('')
    setPage(1)
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const hasFilters = Boolean(action || dateFrom || dateTo || search)

  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, string | number> = { page_size: 5000 }
      if (action) params.action = action
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (search) params.search = search
      const { data } = await auditApi.getLogs(params)
      const rows = unwrapList<AuditLogEntry>(data)
      const header = ['Timestamp', 'Actor', 'Email', 'Action', 'Record', 'IP Address']
      const csv = [
        header.join(','),
        ...rows.map((r) => [
          formatTimestamp(r.timestamp),
          r.userName ?? '',
          r.userEmail ?? '',
          r.action ?? '',
          r.recordReference ?? r.record ?? '',
          r.ipAddress ?? '',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageShell
      title="Audit log"
      subtitle="Chronological record of actions across the registry."
      action={
        <div className="flex items-center gap-3">
          {count > 0 && (
            <span className="text-sm text-muted">{count.toLocaleString()} entries</span>
          )}
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting || loading}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      }
    >
      <Panel className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label-overline block mb-2">Action</label>
            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1) }}
              className="input w-auto min-w-[160px]"
            >
              {AUDIT_ACTION_FILTER_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-overline block mb-2">From</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="input w-auto" />
          </div>
          <div>
            <label className="label-overline block mb-2">To</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="input w-auto" />
          </div>
          <form onSubmit={applySearch} className="flex-1 min-w-[200px]">
            <label className="label-overline block mb-2">Search</label>
            <input
              type="text"
              placeholder="Email, reference, IP…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input"
            />
          </form>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="btn-ghost btn-sm self-end">
              Clear filters
            </button>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="registry-table">
            <thead>
              <tr>
                {['Timestamp', 'Actor', 'Action', 'Record', 'IP address'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={8} cols={5} />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      title={hasFilters ? 'No matching entries' : 'No audit entries yet'}
                      description={hasFilters ? 'Try adjusting the filters above.' : undefined}
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap font-mono-ref text-xs">{formatTimestamp(log.timestamp)}</td>
                    <td>
                      <div className="font-medium text-[var(--text-primary)] truncate max-w-[160px]">
                        {(log.userName ?? log.user_name) || (log.userEmail ?? log.user_email) || '—'}
                      </div>
                      {(log.userName ?? log.user_name) && (log.userEmail ?? log.user_email) && (
                        <div className="text-xs text-muted truncate max-w-[160px]">
                          {log.userEmail ?? log.user_email}
                        </div>
                      )}
                    </td>
                    <td><AuditActionBadge action={log.action} /></td>
                    <td>
                      {log.record ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/document/${log.record}`)}
                          className="text-sm font-medium text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))] hover:underline truncate max-w-[200px] text-start"
                        >
                          {log.recordReference || log.record}
                        </button>
                      ) : (
                        <span className="text-muted text-xs">{log.recordReference || '—'}</span>
                      )}
                    </td>
                    <td className="font-mono-ref text-xs text-muted whitespace-nowrap">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-registry">
            <span className="text-xs text-muted">
              Page {page} of {totalPages} · {count.toLocaleString()} entries
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </PageShell>
  )
}
