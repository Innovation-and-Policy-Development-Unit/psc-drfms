import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '@/api'
import type { AnalyticsOverview } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Table, TableHead, TableBody } from '@/components/ui/Table'
import { Skeleton } from '@/components/ui/Skeleton'

function Metric({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div className="py-1">
      <p className="label-overline mb-2">{label}</p>
      <p className="font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
  if (href) {
    return <Link to={href} className="block hover:opacity-80 transition-opacity">{inner}</Link>
  }
  return inner
}

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsApi.getOverview()
      .then(({ data }) => setOverview(data))
      .catch(() => setOverview(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <PageShell title="Insights" subtitle="Usage, compliance, and workflow performance.">
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Panel key={i}><Skeleton lines={2} /></Panel>
          ))}
        </div>
      </PageShell>
    )
  }

  const stats = overview?.stats
  const compliance = overview?.compliance
  const workflow = overview?.workflow
  const byType = overview?.recordsByType ?? []

  return (
    <PageShell
      title="Insights"
      subtitle="Operational metrics for records management and PSSM workflow compliance."
      action={
        <Link to="/analytics/audit" className="btn-secondary btn-sm">
          Audit log export
        </Link>
      }
    >
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <section>
            <SectionHeader title="Records overview" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border-default)] border border-registry rounded-sm overflow-hidden">
              {[
                { label: 'Total records', value: stats?.totalRecords ?? 0 },
                { label: 'Added (30 days)', value: stats?.recordsThisMonth ?? 0 },
                { label: 'On legal hold', value: stats?.onLegalHold ?? 0, href: '/compliance/legal-holds' },
                { label: 'Vital records', value: stats?.vitalRecords ?? 0 },
                { label: 'Overdue retention', value: stats?.overdueRecords ?? 0, href: '/compliance/overdue' },
                { label: 'Active workflows', value: stats?.pendingWorkflows ?? 0, href: '/workflows' },
              ].map((m) => (
                <Panel key={m.label} className="rounded-none border-0">
                  <Metric label={m.label} value={m.value} href={m.href} />
                </Panel>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="Records by type" />
            <Table>
              <TableHead>
                <tr><th>Type</th><th className="text-end">Count</th></tr>
              </TableHead>
              <TableBody>
                {byType.map((row) => (
                  <tr key={row.documentType}>
                    <td className="capitalize">{row.documentType.replace(/_/g, ' ')}</td>
                    <td className="text-end font-mono-ref tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>

        <aside className="space-y-4">
          <Panel>
            <SectionHeader title="Workflow performance" className="mb-4" />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Avg completion</dt><dd className="font-mono-ref">{workflow?.averageCompletionDays ?? '—'} days</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Overdue steps</dt><dd className="font-mono-ref text-[var(--status-warning-fg)]">{workflow?.overdueSteps ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">In progress</dt><dd className="font-mono-ref">{workflow?.totalInProgress ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Completed</dt><dd className="font-mono-ref">{workflow?.totalCompleted ?? 0}</dd></div>
            </dl>
          </Panel>

          <Panel>
            <SectionHeader title="Compliance" className="mb-4" />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Incomplete metadata</dt><dd className="font-mono-ref">{compliance?.incompleteMetadata ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Pending destructions</dt><dd className="font-mono-ref">{compliance?.pendingDestructions ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Active holds</dt><dd className="font-mono-ref">{compliance?.activeLegalHolds ?? 0}</dd></div>
            </dl>
          </Panel>
        </aside>
      </div>
    </PageShell>
  )
}
