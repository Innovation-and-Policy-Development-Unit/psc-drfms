import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { complianceApi } from '@/api'
import type { RecordListItem } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function OverdueRecords() {
  const [records, setRecords] = useState<RecordListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    complianceApi.getOverdueRecords()
      .then(({ data }) => setRecords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageShell
      title="Overdue records"
      subtitle="Records past retention date awaiting review or disposition action."
    >
      <Panel className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : records.length === 0 ? (
          <EmptyState title="No overdue records" description="All records are within their retention schedule." />
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Series</th>
                <th>Classification</th>
                <th>Custodian</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/document/${r.id}`} className="font-mono-ref text-xs hover:underline text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))]">
                      {r.referenceNumber}
                    </Link>
                  </td>
                  <td className="max-w-md truncate text-[var(--text-primary)]">{r.title}</td>
                  <td className="text-xs">{r.recordSeriesName ?? '—'}</td>
                  <td><Badge tone="info">{r.classificationLevel}</Badge></td>
                  <td className="text-xs">{r.custodianName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </PageShell>
  )
}
