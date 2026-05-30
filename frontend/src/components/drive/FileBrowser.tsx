import { memo, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRecords } from '@/hooks/useRecords'
import { RecordRow } from '@/components/documents/RecordRow'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHead, TableBody } from '@/components/ui/Table'

interface FileBrowserProps {
  title?: string
  subtitle?: string
  defaultOrdering?: string
  pageSize?: number
  enableBulk?: boolean
  showStarToggle?: boolean
  filterParams?: Record<string, string | boolean>
}

function FileBrowserComponent({
  title,
  subtitle,
  defaultOrdering = '-updated_at',
  pageSize = 25,
  enableBulk = false,
  filterParams = {},
}: FileBrowserProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const page = parseInt(searchParams.get('page') || '1', 10)
  const ordering = searchParams.get('ordering') || defaultOrdering

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = { page, page_size: pageSize, ordering }
    if (!filterParams.starred && !filterParams.shared_with_me) {
      const series = searchParams.get('record_series')
      const docType = searchParams.get('document_type')
      if (series) params.record_series = series
      if (docType) params.document_type = docType
    }
    Object.entries(filterParams).forEach(([k, v]) => { if (v) params[k] = v })
    return params
  }, [page, ordering, pageSize, searchParams, filterParams])

  const { records, count, loading } = useRecords(queryParams)
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {(title || subtitle) && (
        <header className="border-b border-registry pb-4">
          {title && <h1 className="font-serif text-xl font-semibold">{title}</h1>}
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </header>
      )}

      {enableBulk && selected.size > 0 && (
        <div className="panel px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-muted">{selected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {loading ? (
        <div className="panel p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          title="No records"
          description="Upload a document or adjust your filters."
          action={enableBulk ? <Link to="/upload" className="btn-primary btn-sm">Upload</Link> : undefined}
        />
      ) : (
        <Table>
          <TableHead>
            <tr>
              {enableBulk && <th className="w-10" />}
              <th>Reference</th>
              <th>Title</th>
              <th>Type</th>
              <th>Classification</th>
              <th>Modified</th>
              <th className="text-end">Size</th>
            </tr>
          </TableHead>
          <TableBody>
            {records.map((record) => (
              <RecordRow
                key={record.id}
                record={record}
                enableBulk={enableBulk}
                selected={selected.has(record.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{count} record(s)</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.set('page', String(page - 1))
                setSearchParams(p)
              }}
            >
              Previous
            </Button>
            <span className="px-2 py-1 text-muted tabular-nums">{page} / {totalPages}</span>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.set('page', String(page + 1))
                setSearchParams(p)
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(FileBrowserComponent)
