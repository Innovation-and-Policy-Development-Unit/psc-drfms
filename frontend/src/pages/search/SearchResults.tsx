import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X, ChevronLeft, ChevronRight, Building2, CalendarDays, Lock, Star, FileSearch, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { searchApi, type SearchResponse, type SearchFacetValue } from '@/api'
import { aiApi, aiErrorMessage } from '@/api/ai'
import { useAiStatus } from '@/hooks/useAiStatus'
import type { RecordListItem } from '@/types/api'
import { ClassificationBadge, DocumentTypeBadge, DOC_TYPE_LABELS } from '@/lib/recordBadges'
import { Skeleton } from '@/components/ui/Skeleton'

const FILTER_KEYS = ['document_type', 'classification_level', 'ministry', 'year'] as const
type FilterKey = (typeof FILTER_KEYS)[number]
// Set by "describe it in words"; the API already understands them
const EXTRA_KEYS = ['date_from', 'date_to', 'record_series'] as const
const EXTRA_LABELS: Record<(typeof EXTRA_KEYS)[number], (v: string) => string> = {
  date_from: (v) => `From ${v}`,
  date_to: (v) => `Until ${v}`,
  record_series: () => 'Retention series',
}

const FACETS: Array<{ param: FilterKey; title: string; key: keyof SearchResponse['facets']; label?: (v: string) => string }> = [
  { param: 'document_type', title: 'Document type', key: 'documentType', label: (v) => DOC_TYPE_LABELS[v] ?? v },
  { param: 'classification_level', title: 'Classification', key: 'classificationLevel', label: (v) => v.replace(/_/g, ' ') },
  { param: 'ministry', title: 'Ministry', key: 'ministry' },
  { param: 'year', title: 'Document year', key: 'year' },
]

/** Wrap each query term found in `text` in <mark>. */
function Highlight({ text, query }: { text: string; query: string }) {
  const terms = useMemo(
    () => Array.from(new Set(query.toLowerCase().match(/[\w-]{2,}/g) ?? [])).sort((a, b) => b.length - a.length),
    [query],
  )
  if (!terms.length || !text) return <>{text}</>
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="rounded bg-amber-100 px-0.5 text-inherit dark:bg-amber-400/25">{part}</mark>
          : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  )
}

export default function SearchResults() {
  const [params, setParams] = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const page = Number(params.get('page') ?? 1) || 1
  const [input, setInput] = useState(urlQuery)
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const aiStatus = useAiStatus()
  const [plain, setPlain] = useState('')
  const [plainBusy, setPlainBusy] = useState(false)
  const [plainNote, setPlainNote] = useState('')

  const update = (mutate: (p: URLSearchParams) => void, resetPage = true) => {
    const next = new URLSearchParams(params)
    mutate(next)
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }

  // Instant search: type and results follow (debounced)
  useEffect(() => {
    if (input === urlQuery) return
    const t = setTimeout(() => update((p) => (input.trim() ? p.set('q', input) : p.delete('q'))), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  useEffect(() => { setInput(urlQuery) }, [urlQuery])

  const paramString = params.toString()
  const hasCriteria = !!urlQuery || FILTER_KEYS.some((k) => params.get(k)) || EXTRA_KEYS.some((k) => params.get(k))

  const describeSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plain.trim() || plainBusy) return
    setPlainBusy(true)
    setPlainNote('')
    try {
      const { data } = await aiApi.parseSearch(plain)
      const f = data.filters
      const next = new URLSearchParams()
      if (data.q) next.set('q', data.q)
      if (f.documentType) next.set('document_type', f.documentType)
      if (f.classificationLevel) next.set('classification_level', f.classificationLevel)
      if (f.ministry) next.set('ministry', f.ministry)
      if (f.recordSeries) next.set('record_series', f.recordSeries)
      if (f.dateFrom) next.set('date_from', f.dateFrom)
      if (f.dateTo) next.set('date_to', f.dateTo)
      setParams(next, { replace: true })
      setPlainNote(data.unsupported.length ? `Not searchable yet: ${data.unsupported.join('; ')}` : '')
    } catch (err) {
      setPlainNote(aiErrorMessage(err))
    } finally { setPlainBusy(false) }
  }

  useEffect(() => {
    if (!hasCriteria) { setData(null); return }
    let cancelled = false
    setLoading(true)
    setError(false)
    searchApi.search(Object.fromEntries(params))
      .then(({ data: d }) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) { setData(null); setError(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramString])

  useEffect(() => { inputRef.current?.focus() }, [])

  const meaningOn = params.get('mode') !== 'keyword'
  const active = FILTER_KEYS.filter((k) => params.get(k))
  const labelFor = (param: FilterKey, value: string) => {
    const f = FACETS.find((x) => x.param === param)
    return f?.label ? f.label(value) : value
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Search</h1>
        <p className="mt-1 text-sm text-gray-500">
          Full text across titles, references, descriptions and scanned content. Typos are forgiven.
        </p>
      </div>

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Try: "teacher allowance"  ·  a reference number  ·  words from inside a scan'
          className="h-14 w-full rounded-2xl border border-gray-200 bg-white ps-12 pe-12 text-base shadow-theme-xs placeholder:text-gray-400 focus:border-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
          aria-label="Search records"
        />
        {input && (
          <button type="button" onClick={() => setInput('')} className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      {aiStatus?.enabled && (
        <form onSubmit={describeSearch} className="space-y-1">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Sparkles size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-primary-500" />
              <input value={plain} onChange={(e) => setPlain(e.target.value)} maxLength={400}
                placeholder='Or describe it in your own words: "contracts from the Ministry of Finance last year"'
                aria-label="Describe what you are looking for"
                className="h-10 w-full rounded-xl border border-gray-200 bg-white ps-9 pe-3 text-sm placeholder:text-gray-400 focus:border-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white" />
            </div>
            <button type="submit" disabled={plainBusy || !plain.trim()} className="rounded-xl border border-primary-200 px-4 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-500/30 dark:text-primary-300">
              {plainBusy ? 'Working…' : 'Set filters'}
            </button>
          </div>
          {plainNote && <p className="text-xs text-amber-700 dark:text-amber-300">{plainNote}</p>}
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={meaningOn}
            onChange={() => update((p) => (meaningOn ? p.set('mode', 'keyword') : p.delete('mode')))}
          />
          <span className="relative h-5 w-9 rounded-full bg-gray-200 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-primary-500 peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4 peer-focus-visible:ring-4 peer-focus-visible:ring-primary-500/20 dark:bg-gray-700" />
          <Sparkles size={14} className="text-primary-500" /> Also match by meaning
        </label>
        {data && data.meaningMatches > 0 && meaningOn && (
          <span className="text-xs text-gray-400">
            {data.meaningMatches} related by meaning{data.meaningExternal ? ' (your search words were sent to Google Gemini)' : ''}
          </span>
        )}
      </div>

      {(active.length > 0 || EXTRA_KEYS.some((k) => params.get(k))) && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => update((p) => p.delete(k))}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300"
            >
              {labelFor(k, params.get(k) as string)} <X size={12} />
            </button>
          ))}
          {EXTRA_KEYS.filter((k) => params.get(k)).map((k) => (
            <button key={k} type="button" onClick={() => update((p) => p.delete(k))}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300">
              {EXTRA_LABELS[k](params.get(k) as string)} <X size={12} />
            </button>
          ))}
          <button type="button" onClick={() => update((p) => [...FILTER_KEYS, ...EXTRA_KEYS].forEach((k) => p.delete(k)))} className="text-xs text-gray-500 hover:underline">
            Clear all
          </button>
        </div>
      )}

      {!hasCriteria ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 py-20 text-center dark:border-gray-800">
          <FileSearch size={36} className="mb-3 text-gray-300" />
          <p className="font-medium text-gray-700 dark:text-gray-200">Start typing to search the registry</p>
          <p className="mt-1 text-sm text-gray-400">Tip: press <kbd className="rounded border px-1">/</kbd> anywhere to jump to search.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Facets */}
          <aside className="space-y-5 lg:sticky lg:top-0 lg:self-start">
            {FACETS.map(({ param, title, key, label }) => {
              const values: SearchFacetValue[] = data?.facets[key] ?? []
              if (!values.length) return null
              const current = params.get(param)
              return (
                <section key={param} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 font-sans">{title}</h2>
                  <ul className="space-y-0.5">
                    {values.map((v) => {
                      const on = current === v.value
                      return (
                        <li key={v.value}>
                          <button
                            type="button"
                            onClick={() => update((p) => (on ? p.delete(param) : p.set(param, v.value)))}
                            className={clsx(
                              'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors',
                              on ? 'bg-primary-50 font-medium text-primary-600 dark:bg-primary-500/15 dark:text-primary-300'
                                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
                            )}
                          >
                            <span className={clsx("truncate", param !== "ministry" && "capitalize")}>{label ? label(v.value) : v.value}</span>
                            <span className="tabular-nums text-xs text-gray-400">{v.count}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </aside>

          {/* Results */}
          <div className="min-w-0 space-y-3">
            <p className="text-sm text-gray-500" aria-live="polite">
              {loading && !data ? 'Searching…' : data ? `${data.count.toLocaleString()} result${data.count !== 1 ? 's' : ''}${urlQuery ? ` for “${urlQuery}”` : ''}` : ''}
            </p>

            {error && <div className="alert-danger text-sm">Search is unavailable right now. Please try again.</div>}

            <div className={clsx('space-y-3 transition-opacity', loading && data && 'opacity-60')}>
              {loading && !data
                ? [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
                : data?.results.map((r) => <ResultCard key={r.id} record={r} query={urlQuery} />)}
            </div>

            {data && data.count === 0 && !loading && (
              <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center dark:border-gray-800">
                <p className="font-medium text-gray-700 dark:text-gray-200">No records found</p>
                {data.didYouMean ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Did you mean{' '}
                    <button type="button" className="font-medium text-primary-500 hover:underline" onClick={() => setInput(data.didYouMean as string)}>
                      {data.didYouMean}
                    </button>
                    ?
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">Try fewer words, or remove a filter.</p>
                )}
              </div>
            )}

            {data && data.pages > 1 && (
              <nav className="flex items-center justify-between pt-2" aria-label="Pagination">
                <button type="button" disabled={page <= 1} onClick={() => update((p) => p.set('page', String(page - 1)), false)} className="btn-secondary btn-sm disabled:opacity-40">
                  <ChevronLeft size={14} /> Previous
                </button>
                <span className="text-xs text-gray-500">Page {data.page} of {data.pages}</span>
                <button type="button" disabled={page >= data.pages} onClick={() => update((p) => p.set('page', String(page + 1)), false)} className="btn-secondary btn-sm disabled:opacity-40">
                  Next <ChevronRight size={14} />
                </button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ record, query }: { record: RecordListItem; query: string }) {
  const ref = record.referenceNumber ?? (record as { reference_number?: string }).reference_number
  return (
    <Link
      to={`/document/${record.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 truncate font-sans text-base font-semibold text-gray-900 dark:text-white">
          <Highlight text={record.title} query={query} />
        </h3>
        {record.isOnLegalHold && <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><Lock size={12} /> Hold</span>}
        {record.isVital && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Star size={12} /> Vital</span>}
        {record.matchedBy === 'meaning' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600 dark:bg-primary-500/15 dark:text-primary-300" title="No exact words matched; this passage is close in meaning to your search">
            <Sparkles size={11} /> Related by meaning
          </span>
        )}
      </div>
      <p className="mt-0.5 font-mono-ref text-xs text-gray-400"><Highlight text={ref ?? ''} query={query} /></p>
      {record.matchSnippet && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
          <Highlight text={record.matchSnippet} query={query} />
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <DocumentTypeBadge type={record.documentType} />
        <ClassificationBadge level={record.classificationLevel} />
        {record.originatingMinistry && <span className="inline-flex items-center gap-1"><Building2 size={12} /> {record.originatingMinistry}</span>}
        {record.documentDate && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {new Date(record.documentDate).toLocaleDateString()}</span>}
      </div>
    </Link>
  )
}
