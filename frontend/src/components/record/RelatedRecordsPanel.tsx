import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Link2, Plus, Search, X } from 'lucide-react'
import { featuresApi, RELATION_TYPES, type RelationRow, type RelationType } from '@/api/features'
import { searchApi, type SearchSuggestion } from '@/api'
import { aiErrorMessage } from '@/api/ai'
import { ClassificationBadge, DocumentTypeBadge } from '@/lib/recordBadges'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

interface Props {
  recordId: string
  canEdit: boolean
  onChanged?: () => void
}

/** Links to other records: replies, superseded versions, references, or just "related". */
export default function RelatedRecordsPanel({ recordId, canEdit, onChanged }: Props) {
  const [rows, setRows] = useState<RelationRow[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchSuggestion[]>([])
  const [target, setTarget] = useState<SearchSuggestion | null>(null)
  const [type, setType] = useState<RelationType>('related')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const abort = useRef<AbortController>()

  const load = useCallback(() => {
    featuresApi.relations(recordId).then(({ data }) => setRows(data.results)).catch((e) => { setRows([]); setError(aiErrorMessage(e)) })
  }, [recordId])
  useEffect(() => { setRows(null); load() }, [load])

  useEffect(() => {
    const q = query.trim()
    if (target || q.length < 2) { setHits([]); return }
    const t = setTimeout(() => {
      abort.current?.abort()
      abort.current = new AbortController()
      searchApi.suggest(q, abort.current.signal)
        .then(({ data }) => setHits(data.filter((h) => h.id !== recordId)))
        .catch(() => { /* keep the last list */ })
    }, 200)
    return () => clearTimeout(t)
  }, [query, target, recordId])

  const reset = () => { setAdding(false); setQuery(''); setHits([]); setTarget(null); setType('related'); setNote(''); setError('') }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) return
    setBusy(true)
    setError('')
    try {
      await featuresApi.addRelation(recordId, target.id, type, note.trim())
      reset()
      load()
      onChanged?.()
    } catch (err) { setError(aiErrorMessage(err)) } finally { setBusy(false) }
  }

  const remove = async (row: RelationRow) => {
    setError('')
    try { await featuresApi.removeRelation(recordId, row.id); load(); onChanged?.() } catch (err) { setError(aiErrorMessage(err)) }
  }

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Link2 size={16} /> Related records</h3>
          <p className="mt-0.5 text-xs text-muted">Replies, earlier versions this replaces, and other records it refers to.</p>
        </div>
        {canEdit && !adding && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus size={14} /> Link a record</Button>}
      </div>

      {adding && (
        <form onSubmit={add} className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
          {target ? (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
              <span className="min-w-0 truncate"><span className="font-mono-ref text-xs text-muted">{target.referenceNumber}</span> {target.title}</span>
              <button type="button" onClick={() => { setTarget(null); setQuery('') }} aria-label="Choose a different record" className="shrink-0 rounded p-1 hover:bg-[var(--surface-raised)]"><X size={14} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for the record by title or reference…" aria-label="Find a record to link" className="input w-full ps-9" />
              {hits.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] py-1 shadow-lg">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button type="button" onClick={() => { setTarget(h); setHits([]) }} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-[var(--surface-sunken)]">
                        <span className="font-mono-ref shrink-0 text-xs text-muted">{h.referenceNumber}</span>
                        <span className="min-w-0 flex-1 truncate">{h.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <select value={type} onChange={(e) => setType(e.target.value as RelationType)} className="input" aria-label="Kind of link">
              {RELATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Optional note, e.g. “our reply of 3 March”" aria-label="Note" className="input" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!target || busy}>{busy ? 'Linking…' : 'Link'}</Button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows === null ? <Skeleton lines={3} /> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-default)] p-6 text-center text-sm text-muted">Nothing is linked to this record yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 w-28 shrink-0 text-xs font-medium text-muted">{r.label}</span>
              <div className="min-w-0 flex-1">
                <Link to={`/document/${r.record.id}`} className="block truncate text-sm font-medium hover:underline">{r.record.title}</Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-mono-ref">{r.record.referenceNumber}</span>
                  <DocumentTypeBadge type={r.record.documentType} />
                  <ClassificationBadge level={r.record.classificationLevel} />
                </div>
                {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
              </div>
              {canEdit && <button type="button" onClick={() => remove(r)} aria-label={`Remove link to ${r.record.title}`} className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-[var(--surface-sunken)] hover:text-red-600"><X size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
