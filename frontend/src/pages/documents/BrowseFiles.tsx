import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FileBrowser from '@/components/drive/FileBrowser'
import BrowseOverview from '@/components/drive/BrowseOverview'
import { driveApi, type RecordSeriesItem } from '@/api/drive'
import type { BreadcrumbItem } from '@/types/api'

let seriesCache: RecordSeriesItem[] | null = null

const seriesLink = (id: number) => `/browse?record_series=${id}`

export default function BrowseFiles() {
  const [params] = useSearchParams()
  const seriesId = params.get('record_series')
  const [series, setSeries] = useState<RecordSeriesItem[]>(seriesCache ?? [])

  useEffect(() => {
    if (seriesCache) return
    driveApi.series()
      .then(({ data }) => {
        seriesCache = (Array.isArray(data) ? data : data.results).filter((s) => s.isActive)
        setSeries(seriesCache)
      })
      .catch(() => { /* breadcrumbs simply stay at "All files" */ })
  }, [])

  // All files > (parent series >) current series; each level can jump to its siblings
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const siblingsOf = (parent: number | null, currentId: number | null) =>
      series.filter((s) => s.parent === parent).map((s) => ({
        label: `${s.code} — ${s.name}`, to: seriesLink(s.id), current: s.id === currentId,
      }))
    const roots = siblingsOf(null, null)
    const current = series.find((s) => String(s.id) === seriesId)

    if (!current) {
      return seriesId ? [{ label: 'All files', to: '/browse' }] : [{ label: 'All files', siblings: roots.length ? [{ label: 'All files', to: '/browse', current: true }, ...roots] : undefined }]
    }
    const chain: RecordSeriesItem[] = []
    for (let s: RecordSeriesItem | undefined = current; s; s = series.find((p) => p.id === s?.parent)) chain.unshift(s)
    return [
      { label: 'All files', to: '/browse' },
      ...chain.map((s) => {
        const siblings = siblingsOf(s.parent, s.id)
        return { label: `${s.code} — ${s.name}`, ...(s.id === current.id ? {} : { to: seriesLink(s.id) }), siblings: siblings.length > 1 ? siblings : undefined }
      }),
    ]
  }, [series, seriesId])

  return (
    <FileBrowser
      title="All files"
      subtitle="Browse the organisation records registry"
      breadcrumbs={breadcrumbs}
      defaultOrdering="-updated_at"
      enableBulk
      driveMode
      header={<BrowseOverview />}
    />
  )
}
