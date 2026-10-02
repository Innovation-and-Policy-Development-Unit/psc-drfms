import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Folder, Tag, X } from 'lucide-react'
import clsx from 'clsx'
import { searchApi, type SearchResponse } from '@/api'
import { DOC_TYPE_LABELS } from '@/lib/recordBadges'

/**
 * "Browse by" strip above the file list: record series as folder cards and
 * document types as chips, each with a live count. Choosing one filters the
 * list through the same URL parameters the list already understands.
 * Counts come from the search facets, so they only include records the
 * viewer may see, and each group ignores its own filter so alternatives stay visible.
 */
export default function BrowseOverview() {
  const [params, setParams] = useSearchParams()
  const docType = params.get('document_type')
  const series = params.get('record_series')
  const tag = params.get('tag')
  const [facets, setFacets] = useState<SearchResponse['facets'] | null>(null)

  useEffect(() => {
    let cancelled = false
    searchApi.search({
      page_size: 1,
      ...(docType ? { document_type: docType } : {}),
      ...(series ? { record_series: series } : {}),
    })
      .then(({ data }) => { if (!cancelled) setFacets(data.facets) })
      .catch(() => { if (!cancelled) setFacets(null) })
    return () => { cancelled = true }
  }, [docType, series])

  const toggle = (key: 'document_type' | 'record_series', value: string, current: string | null) => {
    const next = new URLSearchParams(params)
    next.delete('page')
    if (current === value) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }

  const clearAll = () => {
    const next = new URLSearchParams(params)
    next.delete('page')
    next.delete('document_type')
    next.delete('record_series')
    next.delete('tag')
    setParams(next)
  }

  const types = facets?.documentType ?? []
  const folders = facets?.recordSeries ?? []
  if (types.length === 0 && folders.length === 0 && !docType && !series && !tag) return null

  return (
    <div className="space-y-4 border-b border-registry px-4 py-4">
      {tag && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Showing records tagged</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 py-1 ps-2.5 pe-1.5 font-medium text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
            <Tag size={12} /> {tag}
            <button
              type="button"
              onClick={() => { const next = new URLSearchParams(params); next.delete('tag'); next.delete('page'); setParams(next) }}
              className="rounded-full p-0.5 hover:bg-primary-100 dark:hover:bg-primary-500/25"
              aria-label="Remove tag filter"
            >
              <X size={12} />
            </button>
          </span>
        </div>
      )}

      {folders.length > 0 && (
        <section aria-label="Record series">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 font-sans">Record series</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {folders.map((f) => {
              const on = series === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => toggle('record_series', f.value, series)}
                  aria-pressed={on}
                  className={clsx(
                    'flex items-center gap-3 rounded-2xl border p-3 text-start transition-all hover:-translate-y-0.5 hover:shadow-theme-sm',
                    on
                      ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-500/15 dark:bg-primary-500/10'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500 dark:bg-primary-500/15">
                    <Folder size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">{f.label}</span>
                    <span className="block text-xs text-gray-400">{f.count} {f.count === 1 ? 'record' : 'records'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {(types.length > 0 || docType) && (
        <section aria-label="Document type" className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clearAll}
            aria-pressed={!docType && !series && !tag}
            className={clsx(
              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              !docType && !series && !tag
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
            )}
          >
            All
          </button>
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
      )}
    </div>
  )
}
