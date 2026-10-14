import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Info, RotateCcw, Search } from 'lucide-react'
import { driveApi, RECORDS_CHANGED_EVENT, type BinItem } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'
import { useAuth } from '@/context/AuthContext'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ClassificationBadge } from '@/lib/recordBadges'
import { formatDate } from '@/lib/driveFormat'
import { formatFileSize } from '@/utils/fileType'

/** Deleted records wait here until someone restores them. Nothing is ever erased from this page. */
export default function RecycleBin() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'administrator'
  const [items, setItems] = useState<BinItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    driveApi.bin(query.trim() || undefined)
      .then(({ data }) => { setItems(data.results); setTotal(data.count) })
      .catch((e) => { setItems([]); setError(aiErrorMessage(e)) })
  }, [query])

  useEffect(() => {
    const t = setTimeout(load, query ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  // An Undo elsewhere also changes what is in the bin
  useEffect(() => {
    window.addEventListener(RECORDS_CHANGED_EVENT, load)
    return () => window.removeEventListener(RECORDS_CHANGED_EVENT, load)
  }, [load])

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const allSelected = !!items?.length && selected.size === items.length

  const restore = async (ids: string[]) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data } = await driveApi.restoreFromBin(ids)
      if (data.count) setNotice(`Restored ${data.count} ${data.count === 1 ? 'record' : 'records'}.`)
      if (data.failed.length) setError(data.failed.map((f) => `${f.title || f.id}: ${f.detail}`).join(' — '))
      setSelected(new Set())
      window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT))
    } catch (e) {
      setError(aiErrorMessage(e))
    } finally { setBusy(false) }
  }

  return (
    <PageShell
      title="Recycle bin"
      subtitle="Deleted records wait here until someone restores them. They are hidden from lists, search and AI answers meanwhile."
      action={
        <Button size="sm" disabled={busy || selected.size === 0} onClick={() => restore([...selected])}>
          <RotateCcw size={14} /> Restore{selected.size > 0 ? ` ${selected.size}` : ''}
        </Button>
      }
    >
      <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
        <Info size={16} className="mt-0.5 shrink-0" />
        <p>
          Records are never erased from the Recycle bin, so there is no “empty bin”. Records leave the system only through the{' '}
          {isAdmin ? <Link to="/compliance/destruction" className="font-medium underline">destruction process</Link> : 'destruction process (an administrator starts it)'}
          , which needs approval and leaves a certificate.
        </p>
      </div>

      {(error || notice) && (
        <p className={`mx-4 mt-3 flex items-center gap-1.5 text-sm ${error ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {error && <AlertCircle size={14} />} {error || notice}
        </p>
      )}

      <div className="px-4 pt-4">
        <div className="relative max-w-sm">
          <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the Recycle bin…" aria-label="Search the Recycle bin" className="input w-full ps-9" />
        </div>
      </div>

      <div className="p-4">
        <Panel className="overflow-x-auto p-0">
          {items === null ? (
            <div className="p-6"><Skeleton lines={5} /></div>
          ) : items.length === 0 ? (
            <EmptyState title={query ? 'No matches' : 'The Recycle bin is empty'} description={query ? 'Nothing in the bin matches that search.' : 'Records you delete will wait here, ready to restore.'} />
          ) : (
            <table className="registry-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))} aria-label="Select all" className="rounded-sm" />
                  </th>
                  <th>Name</th>
                  <th>Classification</th>
                  <th>Was in</th>
                  <th>Deleted</th>
                  <th>By</th>
                  <th className="text-end">Size</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.title}`} className="rounded-sm" /></td>
                    <td className="max-w-sm">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{i.title}</p>
                      <p className="font-mono-ref text-xs text-muted">{i.referenceNumber}</p>
                    </td>
                    <td><ClassificationBadge level={i.classificationLevel} /></td>
                    <td className="text-xs">{i.recordSeriesName || '—'}</td>
                    <td className="whitespace-nowrap text-xs text-muted">{formatDate(i.deletedAt)}</td>
                    <td className="text-xs">{i.deletedByName || '—'}</td>
                    <td className="font-mono-ref text-end text-xs text-muted">{i.fileSize ? formatFileSize(i.fileSize) : '—'}</td>
                    <td className="text-end">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => restore([i.id])}>Restore</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        {items && total > items.length && <p className="mt-2 text-xs text-muted">Showing the {items.length} most recent of {total}. Search to find older ones.</p>}
      </div>
    </PageShell>
  )
}
