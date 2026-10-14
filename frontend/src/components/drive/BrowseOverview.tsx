import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays, Building2, FileImage, FileSpreadsheet, FileText, Folder, Lock, Presentation, Tag, User, X,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { searchApi, type SearchResponse } from '@/api'
import { DOC_TYPE_LABELS } from '@/lib/recordBadges'

type Mode = 'series' | 'ministry' | 'custodian' | 'classification' | 'year'

interface ModeDef {
  mode: Mode
  label: string
  Icon: LucideIcon
  /** URL / records-API parameter this mode filters by */
  param: string
  /** The same filter under the name the search API (which supplies the counts) uses */
  searchParam: string
  values: (f: SearchResponse['facets']) => Array<{ value: string; label: string; count: number }>
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

const MODES: ModeDef[] = [
  { mode: 'series', label: 'Series', Icon: Folder, param: 'record_series', searchParam: 'record_series',
    values: (f) => f.recordSeries.map((v) => ({ value: v.value, label: v.label, count: v.count })) },
  { mode: 'ministry', label: 'Ministry', Icon: Building2, param: 'originating_ministry', searchParam: 'ministry',
    values: (f) => f.ministry.map((v) => ({ value: v.value, label: v.value, count: v.count })) },
  { mode: 'custodian', label: 'Custodian', Icon: User, param: 'custodian', searchParam: 'custodian',
    values: (f) => (f.custodian ?? []).map((v) => ({ value: v.value, label: v.label, count: v.count })) },
  { mode: 'classification', label: 'Classification', Icon: Lock, param: 'classification_level', searchParam: 'classification_level',
    values: (f) => f.classificationLevel.map((v) => ({ value: v.value, label: cap(v.value), count: v.count })) },
  { mode: 'year', label: 'Year', Icon: CalendarDays, param: 'year', searchParam: 'year',
    values: (f) => f.year.map((v) => ({ value: v.value, label: v.value, count: v.count })) },
]

const FILE_TYPES: Array<{ value: string; label: string; Icon: LucideIcon; tone: string }> = [
  { value: 'word', label: 'Word', Icon: FileText, tone: 'text-blue-600' },
  { value: 'excel', label: 'Excel', Icon: FileSpreadsheet, tone: 'text-emerald-600' },
  { value: 'powerpoint', label: 'PowerPoint', Icon: Presentation, tone: 'text-orange-600' },
  { value: 'pdf', label: 'PDF', Icon: FileText, tone: 'text-red-600' },
  { value: 'image', label: 'Images', Icon: FileImage, tone: 'text-violet-600' },
]

const MODE_KEY = 'drive-browse-by'

/**
 * "Browse by" strip above the file list: folder cards for the chosen grouping (series, ministry,
 * custodian, classification or year), document-type chips and file-format chips. Choosing one
 * filters the list through the URL parameters the list already understands. Counts come from the
 * search facets, so they only include records the viewer may see, and each group ignores its own
 * filter so alternatives stay visible.
 */
export default function BrowseOverview() {
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY) as Mode | null
      return saved && MODES.some((m) => m.mode === saved) ? saved : 'series'
    } catch { return 'series' }
  })
  const [facets, setFacets] = useState<SearchResponse['facets'] | null>(null)
  const def = MODES.find((m) => m.mode === mode) as ModeDef

  const docType = params.get('document_type')
  const fileType = params.get('file_type')
  const tag = params.get('tag')
  const active = useMemo(
    () => Object.fromEntries(MODES.map((m) => [m.mode, params.get(m.param)])) as Record<Mode, string | null>,
    [params],
  )
  const filterKey = [docType, ...MODES.map((m) => active[m.mode])].join('|')

  useEffect(() => {
    let cancelled = false
    searchApi.search({
      page_size: 1,
      ...(docType ? { document_type: docType } : {}),
      ...Object.fromEntries(MODES.filter((m) => active[m.mode]).map((m) => [m.searchParam, active[m.mode] as string])),
    })
      .then(({ data }) => { if (!cancelled) setFacets(data.facets) })
      .catch(() => { if (!cancelled) setFacets(null) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  const chooseMode = (m: Mode) => {
    setMode(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* per-visit only */ }
  }

  const toggle = (key: string, value: string, current: string | null) => {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (current === value) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  const clearAll = () => {
    const next = new URLSearchParams(params)
    ;['page', 'document_type', 'file_type', 'tag', ...MODES.map((m) => m.param)].forEach((k) => next.delete(k))
    setParams(next)
  }

  const types = facets?.documentType ?? []
  const cards = facets ? def.values(facets) : []
  const anyFilter = !!(docType || fileType || tag || MODES.some((m) => active[m.mode]))
  const activeChips = MODES.filter((m) => m.mode !== 'series' && active[m.mode])

  return (
    <div className="space-y-4 border-b border-registry px-4 py-4">
      {(tag || activeChips.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {tag && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 ps-2.5 pe-1.5 font-medium text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
              <Tag size={12} /> {tag}
              <button type="button" onClick={() => toggle('tag', tag, tag)} className="rounded-full p-0.5 hover:bg-primary-100 dark:hover:bg-primary-500/25" aria-label="Remove tag filter"><X size={12} /></button>
            </span>
          )}
          {activeChips.map((m) => {
            const value = active[m.mode] as string
            const label = facets ? m.values(facets).find((v) => v.value === value)?.label ?? value : value
            return (
              <span key={m.mode} className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 ps-2.5 pe-1.5 font-medium text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
                <m.Icon size={12} /> {label}
                <button type="button" onClick={() => toggle(m.param, value, value)} className="rounded-full p-0.5 hover:bg-primary-100 dark:hover:bg-primary-500/25" aria-label={`Remove ${m.label} filter`}><X size={12} /></button>
              </span>
            )
          })}
        </div>
      )}

      <section aria-label="Browse by">
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 font-sans">Browse by</p>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Group records by">
            {MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                role="tab"
                aria-selected={mode === m.mode}
                onClick={() => chooseMode(m.mode)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  mode === m.mode
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10',
                )}
              >
                <m.Icon size={12} /> {m.label}
              </button>
            ))}
          </div>
        </div>

        {cards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {cards.map((c) => {
              const on = active[mode] === c.value
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggle(def.param, c.value, active[mode])}
                  aria-pressed={on}
                  className={clsx(
                    'flex items-center gap-3 rounded-2xl border p-3 text-start transition-all hover:-translate-y-0.5 hover:shadow-theme-sm',
                    on
                      ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-500/15 dark:bg-primary-500/10'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500 dark:bg-primary-500/15">
                    <def.Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{c.label}</span>
                    <span className="block text-xs text-gray-400">{c.count} {c.count === 1 ? 'record' : 'records'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : facets && (
          <p className="text-xs text-gray-400">Nothing to group by here yet.</p>
        )}
      </section>

      <section aria-label="Filter by type" className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={clearAll}
          aria-pressed={!anyFilter}
          className={clsx(
            'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
            !anyFilter
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
          )}
        >
          All
        </button>

        {FILE_TYPES.map(({ value, label, Icon, tone }) => {
          const on = fileType === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle('file_type', value, fileType)}
              aria-pressed={on}
              title={`Show only ${label} files`}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                on
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
              )}
            >
              <Icon size={14} className={on ? '' : tone} /> {label}
            </button>
          )
        })}

        {types.length > 0 && <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" aria-hidden />}

        {types.map((t) => {
          const on = docType === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => toggle('document_type', t.value, docType)}
              aria-pressed={on}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                on
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
              )}
            >
              {DOC_TYPE_LABELS[t.value] ?? t.value.replace(/_/g, ' ')}
              <span className={clsx('text-xs tabular-nums', on ? 'text-white/80' : 'text-gray-400')}>{t.count}</span>
            </button>
          )
        })}
      </section>
    </div>
  )
}
