import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { complianceApi, recordsApi, unwrapList, type DispositionReview } from '@/api'
import { recordDetailPath } from '@/lib/driveRecordActions'
import { useAuth } from '@/context/AuthContext'
import type { RetentionSchedule } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function RetentionSchedulePage() {
  const [schedules, setSchedules] = useState<RetentionSchedule[]>([])
  const [seriesList, setSeriesList] = useState<Array<{ id: number; code: string; name: string }>>([])
  const [reviews, setReviews] = useState<DispositionReview[]>([])
  const [loading, setLoading] = useState(true)
  const [scanQueued, setScanQueued] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    recordSeries: '',
    retentionYears: '7',
    dispositionAction: 'review',
    statutoryBasis: '',
  })
  const { user } = useAuth()
  const canDecide = ['director', 'commissioner', 'administrator'].includes(user?.role ?? '')
  const isAdmin = user?.role === 'administrator'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [schedRes, seriesRes, reviewRes] = await Promise.all([
        complianceApi.getRetentionSchedules(),
        recordsApi.getRecordSeries(),
        complianceApi.getDispositionReviews('pending'),
      ])
      setSchedules(unwrapList(schedRes.data))
      setSeriesList(unwrapList(seriesRes.data))
      setReviews(unwrapList(reviewRes.data))
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDecide = async (id: string, action: 'approve' | 'dismiss') => {
    await complianceApi.decideDisposition(id, action)
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const handleScan = async () => {
    await complianceApi.triggerRetentionScan()
    setScanQueued(true)
    setTimeout(() => setScanQueued(false), 4000)
  }

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await complianceApi.createRetentionSchedule({
      recordSeries: Number(form.recordSeries),
      retentionYears: Number(form.retentionYears),
      dispositionAction: form.dispositionAction,
      statutoryBasis: form.statutoryBasis,
      autoFlagForReview: true,
    })
    setShowForm(false)
    load()
  }

  return (
    <PageShell
      title="Retention schedules"
      subtitle="Configure retention rules by record series aligned to OPSC statutory functions."
      action={
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="secondary" onClick={handleScan} disabled={scanQueued}>
              {scanQueued ? 'Scan queued…' : 'Run scan now'}
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}>Add schedule</Button>
        </div>
      }
    >
      <Panel className="p-0 overflow-x-auto mb-4">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-base font-semibold">Disposition queue</h2>
            <p className="text-xs text-muted mt-0.5">
              Records past their retention date, flagged by the nightly scan. Approval here feeds the destruction certificate process.
            </p>
          </div>
          {reviews.length > 0 && <span className="badge-warning">{reviews.length} pending</span>}
        </div>
        {loading ? (
          <div className="p-6"><Skeleton lines={3} /></div>
        ) : reviews.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-muted">No records awaiting disposition review.</p>
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Series</th>
                <th>Retention date</th>
                <th>Proposed action</th>
                <th>Flagged</th>
                {canDecide && <th className="text-end">Decision</th>}
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={recordDetailPath(r.record)} className="hover:underline">
                      <span className="font-mono-ref text-xs text-muted">{r.recordReference}</span>
                      <span className="block text-sm text-[var(--text-primary)]">{r.recordTitle}</span>
                    </Link>
                  </td>
                  <td className="font-mono-ref text-xs">{r.recordSeriesCode ?? '—'}</td>
                  <td>{new Date(r.retentionDate).toLocaleDateString()}</td>
                  <td className="capitalize">{r.proposedAction}</td>
                  <td className="text-xs text-muted">{new Date(r.flaggedAt).toLocaleDateString()}</td>
                  {canDecide && (
                    <td>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => handleDecide(r.id, 'dismiss')}>Dismiss</Button>
                        <Button size="sm" onClick={() => handleDecide(r.id, 'approve')}>Approve</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : schedules.length === 0 ? (
          <EmptyState title="No retention schedules" description="Define retention periods per classification series." />
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Series</th>
                <th>Retention</th>
                <th>Disposition</th>
                <th>Statutory basis</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="font-mono-ref text-xs text-muted">{s.recordSeriesCode}</span>
                    <span className="block text-sm text-[var(--text-primary)]">{s.recordSeriesName}</span>
                  </td>
                  <td>{s.retentionYears} years</td>
                  <td className="capitalize">{s.dispositionAction}</td>
                  <td className="max-w-xs truncate">{s.statutoryBasis || '—'}</td>
                  <td className="text-xs text-muted">{new Date(s.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form onSubmit={handleCreate} className="panel w-full max-w-md p-6 space-y-4 animate-registry-in">
            <h2 className="font-serif text-lg font-semibold">New retention schedule</h2>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Record series</label>
              <select className="input" value={form.recordSeries} onChange={(e) => setForm({ ...form, recordSeries: e.target.value })} required>
                <option value="">Select series…</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </div>
            <Input label="Retention (years)" type="number" min={1} value={form.retentionYears} onChange={(e) => setForm({ ...form, retentionYears: e.target.value })} required />
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Disposition</label>
              <select className="input" value={form.dispositionAction} onChange={(e) => setForm({ ...form, dispositionAction: e.target.value })}>
                <option value="review">Review</option>
                <option value="destroy">Destroy</option>
                <option value="archive">Archive</option>
                <option value="transfer">Transfer to National Archives</option>
              </select>
            </div>
            <Input label="Statutory basis" value={form.statutoryBasis} onChange={(e) => setForm({ ...form, statutoryBasis: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
