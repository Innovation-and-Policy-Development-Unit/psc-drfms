import { useState, useEffect, FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { recordsApi, unwrapList } from '@/api'
import type { RecordListItem } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import {
  ClassificationBadge,
  DocumentTypeBadge,
  RecordLifecycleBadge,
  DOCUMENT_TYPE_OPTIONS,
} from '@/lib/recordBadges'

export default function RecordList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [records, setRecords] = useState<RecordListItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const page = parseInt(searchParams.get('page') || '1', 10)

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string | number | boolean> = { page, page_size: 25 }
    if (searchParams.get('search')) params.search = searchParams.get('search')!
    const docType = searchParams.get('document_type')
    const vital = searchParams.get('is_vital')
    if (docType) params.document_type = docType
    if (vital) params.is_vital = vital

    recordsApi.getRecords(params)
      .then(({ data }) => {
        const list = unwrapList<RecordListItem>(data)
        setRecords(list)
        setCount('count' in data && data.count != null ? data.count : list.length)
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [page, searchParams])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams(searchParams)
    if (search) p.set('search', search)
    else p.delete('search')
    p.set('page', '1')
    setSearchParams(p)
  }

  const totalPages = Math.ceil(count / 25)

  return (
    <PageShell
      title="Records"
      subtitle={`${count.toLocaleString()} records in the registry.`}
      action={<Link to="/upload" className="btn-primary btn-sm">Upload record</Link>}
    >
      <Panel className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input flex-1"
            placeholder="Search reference, title, content…"
          />
          <Button type="submit" size="sm">Search</Button>
        </form>
        <select
          className="input w-auto"
          value={searchParams.get('document_type') || ''}
          onChange={(e) => {
            const p = new URLSearchParams(searchParams)
            if (e.target.value) p.set('document_type', e.target.value)
            else p.delete('document_type')
            p.set('page', '1')
            setSearchParams(p)
          }}
        >
          <option value="">All types</option>
          {DOCUMENT_TYPE_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={searchParams.get('is_vital') === 'true'}
            onChange={(e) => {
              const p = new URLSearchParams(searchParams)
              if (e.target.checked) p.set('is_vital', 'true')
              else p.delete('is_vital')
              p.set('page', '1')
              setSearchParams(p)
            }}
          />
          Vital only
        </label>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="registry-table">
            <thead>
              <tr>
                {['Reference', 'Title', 'Type', 'Classification', 'Custodian', 'Date', 'Status', ''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton rows={8} cols={8} />
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState title="No records found" description="Adjust filters or upload a new record." />
                  </td>
                </tr>
              ) : (
                records.map((record) => {
                  const ref = record.referenceNumber ?? (record as { reference_number?: string }).reference_number
                  const docType = record.documentType ?? (record as { document_type?: string }).document_type
                  const classification = record.classificationLevel ?? (record as { classification_level?: string }).classification_level
                  const custodian = record.custodianName ?? (record as { custodian_name?: string }).custodian_name
                  const docDate = record.documentDate ?? (record as { document_date?: string }).document_date
                  const onHold = record.isOnLegalHold ?? (record as { is_on_legal_hold?: boolean }).is_on_legal_hold
                  const isDraft = record.isDraft ?? (record as { is_draft?: boolean }).is_draft
                  const isVital = record.isVital ?? (record as { is_vital?: boolean }).is_vital
                  return (
                    <tr key={record.id}>
                      <td className="font-mono-ref text-xs">{ref}</td>
                      <td>
                        <Link to={`/document/${record.id}`} className="font-medium hover:underline line-clamp-1">
                          {isVital ? '★ ' : ''}{record.title}
                        </Link>
                      </td>
                      <td><DocumentTypeBadge type={docType} /></td>
                      <td><ClassificationBadge level={classification} /></td>
                      <td>{custodian || '—'}</td>
                      <td className="text-muted">
                        {docDate ? new Date(docDate).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <RecordLifecycleBadge isOnLegalHold={onHold} isDraft={isDraft} />
                      </td>
                      <td className="text-end">
                        <Link to={`/document/${record.id}`} className="btn-ghost btn-sm">Open</Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-registry">
            <p className="text-sm text-muted">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, count)} of {count}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 1}
                onClick={() => setSearchParams((p) => {
                  const np = new URLSearchParams(p)
                  np.set('page', String(page - 1))
                  return np
                })}
              >
                Previous
              </Button>
              <span className="btn-sm btn-secondary">{page} / {totalPages}</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setSearchParams((p) => {
                  const np = new URLSearchParams(p)
                  np.set('page', String(page + 1))
                  return np
                })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </PageShell>
  )
}
