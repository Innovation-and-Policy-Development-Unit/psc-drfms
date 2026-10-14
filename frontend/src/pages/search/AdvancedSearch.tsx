import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { authApi } from '@/api'
import { driveApi, type RecordSeriesItem } from '@/api/drive'
import { featuresApi, type SearchCondition, type SearchField } from '@/api/features'
import { aiErrorMessage } from '@/api/ai'
import { ClassificationBadge, DocumentTypeBadge } from '@/lib/recordBadges'
import { formatDate } from '@/lib/driveFormat'
import type { RecordListItem } from '@/types/api'
import { PinButton } from '@/components/drive/PinButton'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const OP_LABELS: Record<string, string> = {
  contains: 'contains', not_contains: 'does not contain', equals: 'is exactly', starts_with: 'starts with',
  is_empty: 'is empty', is_not_empty: 'is not empty', is: 'is', is_not: 'is not', on: 'is on', before: 'is before',
  after: 'is after', between: 'is between', has: 'has', not_has: 'does not have',
}
const ORDERINGS = [
  { value: '-updated_at', label: 'Recently modified' }, { value: '-created_at', label: 'Recently added' },
  { value: 'title', label: 'Title A–Z' }, { value: 'reference_number', label: 'Reference' },
  { value: '-document_date', label: 'Document date, newest' }, { value: 'retention_date', label: 'Retention date, soonest' },
]
const NO_VALUE = new Set(['is_empty', 'is_not_empty'])

interface Person { id: number; email: string; fullName?: string; full_name?: string }
type Row = SearchCondition & { id: number }

// Searches live in the URL so they can be bookmarked or pinned to Quick access
const encode = (match: string, conditions: SearchCondition[]) => btoa(unescape(encodeURIComponent(JSON.stringify({ m: match, c: conditions }))))
function decode(raw: string | null): { match: 'all' | 'any'; conditions: SearchCondition[] } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(raw))))
    return Array.isArray(parsed.c) ? { match: parsed.m === 'any' ? 'any' : 'all', conditions: parsed.c } : null
  } catch { return null }
}

let nextId = 1

export default function AdvancedSearch() {
  const [params, setParams] = useSearchParams()
  const [fields, setFields] = useState<SearchField[]>([])
  const [series, setSeries] = useState<RecordSeriesItem[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [match, setMatch] = useState<'all' | 'any'>('all')
  const [rows, setRows] = useState<Row[]>([])
  const [ordering, setOrdering] = useState('-updated_at')
  const [results, setResults] = useState<{ count: number; page: number; pages: number; results: RecordListItem[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  const byKey = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields])

  useEffect(() => {
    featuresApi.searchFields().then(({ data }) => setFields(data.fields)).catch((e) => setError(aiErrorMessage(e)))
    driveApi.activeSeries().then(setSeries).catch(() => setSeries([]))
    authApi.getUsers({ page_size: '200' }).then(({ data }) => setPeople((data.results ?? data) as Person[])).catch(() => setPeople([]))
  }, [])

  const run = useCallback(async (conds: SearchCondition[], m: 'all' | 'any', order: string, page = 1) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await featuresApi.advancedSearch({ conditions: conds, match: m, ordering: order, page, pageSize: 25 })
      setResults(data)
    } catch (e) { setResults(null); setError(aiErrorMessage(e)) } finally { setBusy(false) }
  }, [])

  // A search arriving in the URL (bookmark, pinned view) fills the form and runs once the field list is known
  useEffect(() => {
    if (started.current || fields.length === 0) return
    started.current = true
    const saved = decode(params.get('c'))
    if (saved && saved.conditions.length) {
      setMatch(saved.match)
      setRows(saved.conditions.map((c) => ({ ...c, id: nextId++ })))
      const order = params.get('ordering') || '-updated_at'
      setOrdering(order)
      void run(saved.conditions, saved.match, order)
    } else {
      setRows([{ id: nextId++, field: 'title', op: 'contains', value: '' }])
    }
  }, [fields, params, run])

  const patch = (id: number, change: Partial<SearchCondition>) => setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...change } : r)))

  const changeField = (id: number, key: string) => {
    const f = byKey[key]
    patch(id, { field: key, op: f.operators[0], value: f.type === 'bool' ? true : '', value2: '' })
  }

  const clean = (): SearchCondition[] => rows.map(({ id: _id, ...c }) => c)

  const search = (e?: React.FormEvent) => {
    e?.preventDefault()
    const conds = clean()
    const next = new URLSearchParams({ c: encode(match, conds) })
    if (ordering !== '-updated_at') next.set('ordering', ordering)
    setParams(next, { replace: true })
    void run(conds, match, ordering)
  }

  const valueInput = (r: Row) => {
    const f = byKey[r.field]
    if (!f || NO_VALUE.has(r.op)) return null
    const common = { 'aria-label': 'Value', className: 'input min-w-0 flex-1' }
    const val = typeof r.value === 'string' ? r.value : ''
    switch (f.type) {
      case 'choice':
        return <select {...common} value={val} onChange={(e) => patch(r.id, { value: e.target.value })}><option value="">Choose…</option>{f.choices?.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
      case 'series':
        return <select {...common} value={val} onChange={(e) => patch(r.id, { value: e.target.value })}><option value="">Choose…</option>{series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
      case 'person':
        return <select {...common} value={val} onChange={(e) => patch(r.id, { value: e.target.value })}><option value="">Choose…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.fullName ?? p.full_name ?? p.email}</option>)}</select>
      case 'bool':
        return <select {...common} value={String(r.value ?? true)} onChange={(e) => patch(r.id, { value: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select>
      case 'date':
        return (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <input type="date" {...common} value={val} onChange={(e) => patch(r.id, { value: e.target.value })} />
            {r.op === 'between' && <><span className="text-xs text-muted">and</span><input type="date" aria-label="End date" className="input min-w-0 flex-1" value={r.value2 ?? ''} onChange={(e) => patch(r.id, { value2: e.target.value })} /></>}
          </span>
        )
      default:
        return <input {...common} value={val} onChange={(e) => patch(r.id, { value: e.target.value })} placeholder={f.type === 'tag' ? 'tag' : f.type === 'fulltext' ? 'words to find in the title or the scanned text' : ''} />
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Advanced search</h1>
          <p className="mt-1 text-sm text-gray-500">Build a search from conditions. You only see records you are allowed to open.</p>
        </div>
        <Link to="/search" className="ms-auto text-sm font-medium text-primary-600 hover:underline dark:text-primary-300">Simple search</Link>
        {results && <PinButton defaultLabel="Advanced search" />}
      </div>

      <form onSubmit={search} className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Find records that match
          <select value={match} onChange={(e) => setMatch(e.target.value as 'all' | 'any')} aria-label="Match all or any" className="input h-9 w-auto py-1">
            <option value="all">all</option><option value="any">any</option>
          </select>
          of these conditions:
        </div>

        {fields.length === 0 ? <Skeleton lines={2} /> : rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            <select value={r.field} onChange={(e) => changeField(r.id, e.target.value)} aria-label="Field" className="input w-44">
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            {byKey[r.field] && (
              <select value={r.op} onChange={(e) => patch(r.id, { op: e.target.value })} aria-label="Condition" className="input w-40">
                {byKey[r.field].operators.map((o) => <option key={o} value={o}>{OP_LABELS[o] ?? o}</option>)}
              </select>
            )}
            {valueInput(r)}
            <button type="button" aria-label="Remove condition" disabled={rows.length === 1} onClick={() => setRows((cur) => cur.filter((x) => x.id !== r.id))} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30 dark:hover:bg-white/10"><X size={15} /></button>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="button" size="sm" variant="ghost" disabled={rows.length >= 15} onClick={() => setRows((cur) => [...cur, { id: nextId++, field: 'title', op: 'contains', value: '' }])}><Plus size={14} /> Add condition</Button>
          <select value={ordering} onChange={(e) => setOrdering(e.target.value)} aria-label="Sort results" className="input ms-auto h-9 w-auto py-1">
            {ORDERINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button type="submit" disabled={busy || fields.length === 0}><Search size={14} /> {busy ? 'Searching…' : 'Search'}</Button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && (
        <section aria-live="polite">
          <p className="mb-2 text-sm text-gray-500">{results.count} {results.count === 1 ? 'record' : 'records'} found</p>
          {results.results.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400 dark:border-gray-800">Nothing matches. Try “any” instead of “all”, or remove a condition.</p>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              {results.results.map((r) => (
                <li key={r.id}>
                  <Link to={`/document/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 hover:bg-gray-50 dark:hover:bg-white/5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{r.title}</span>
                    <span className="font-mono-ref text-xs text-gray-400">{r.referenceNumber}</span>
                    <DocumentTypeBadge type={r.documentType} />
                    <ClassificationBadge level={r.classificationLevel} />
                    <span className="text-xs text-gray-400">{r.documentDate ? formatDate(r.documentDate) : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {results.pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <Button size="sm" variant="secondary" disabled={results.page <= 1 || busy} onClick={() => run(clean(), match, ordering, results.page - 1)}>Previous</Button>
              <span className="text-gray-500 tabular-nums">{results.page} / {results.pages}</span>
              <Button size="sm" variant="secondary" disabled={results.page >= results.pages || busy} onClick={() => run(clean(), match, ordering, results.page + 1)}>Next</Button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
