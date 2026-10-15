import { useState, useEffect, useCallback } from 'react'
import { complianceApi, unwrapList } from '@/api'
import type { DispositionReview } from '@/api'
import type { DestructionCertificate } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuth } from '@/context/AuthContext'

const STATUS_TONE: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  completed: 'neutral',
}

export default function DestructionScheduling() {
  const { user } = useAuth()
  const canApprove = ['director', 'commissioner', 'administrator'].includes(user?.role ?? '')
  const [certs, setCerts] = useState<DestructionCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [notes, setNotes] = useState('')
  const [approved, setApproved] = useState<DispositionReview[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await complianceApi.getDestructions()
      setCerts(unwrapList(data))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Only records whose disposition review was approved for destruction can go on a certificate
  const openForm = async () => {
    setError('')
    setSelected([])
    setShowForm(true)
    const { data } = await complianceApi.getDispositionReviews('approved')
    setApproved(unwrapList(data).filter((r) => r.proposedAction === 'destroy'))
  }

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const errorText = (err: unknown, fallback: string) => {
    const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
    const value = data?.records ?? data?.detail
    if (Array.isArray(value)) return value.join(' ')
    return typeof value === 'string' ? value : fallback
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await complianceApi.createDestruction({ notes, destructionMethod: 'Digital deletion', records: selected })
      setShowForm(false)
      setNotes('')
      load()
    } catch (err) {
      setError(errorText(err, 'The certificate could not be created.'))
    }
  }

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    setActionError('')
    try {
      await complianceApi.approveDestruction(id, action)
    } catch (err) {
      setActionError(errorText(err, 'That could not be done.'))
    }
    load()
  }

  return (
    <PageShell
      title="Destruction scheduling"
      subtitle="Formal approval chain and certificates for records past retention."
      action={<Button onClick={openForm}>Request destruction</Button>}
    >
      {actionError && <p role="alert" className="mb-3 text-sm text-red-600">{actionError}</p>}
      <Panel className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : certs.length === 0 ? (
          <EmptyState title="No destruction certificates" description="Certificates are created when records are scheduled for lawful destruction." />
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Certificate</th>
                <th>Status</th>
                <th>Method</th>
                <th>Records</th>
                <th>Authorised by</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono-ref text-xs">{c.certificateNumber}</td>
                  <td><Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge></td>
                  <td>{c.destructionMethod}</td>
                  <td>{c.destroyedRecordsCount}</td>
                  <td>{c.authorisedByName ?? '—'}</td>
                  <td className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td>
                    {canApprove && c.status === 'pending' && (
                      <div className="flex gap-1">
                        {c.authorisedBy === user?.id ? (
                          <span className="text-xs text-muted" title="A different person must approve">Awaiting another approver</span>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => handleApprove(c.id, 'approve')}>Approve</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleApprove(c.id, 'reject')}>{c.authorisedBy === user?.id ? 'Withdraw' : 'Reject'}</Button>
                      </div>
                    )}
                    {c.status === 'completed' && c.pdfFile && (
                      <a className="text-xs underline" href={c.pdfFile} target="_blank" rel="noreferrer">Certificate PDF</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form onSubmit={handleCreate} className="panel w-full max-w-md p-6 space-y-4 animate-registry-in">
            <h2 className="font-serif text-lg font-semibold">Request destruction certificate</h2>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Notes</label>
              <textarea className="input min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scope of destruction, authority reference…" />
            </div>
            <fieldset>
              <legend className="block text-sm font-medium text-secondary mb-1">Records to destroy</legend>
              {approved.length === 0 ? (
                <p className="text-sm text-muted">No records have an approved disposition review for destruction.</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto space-y-1">
                  {approved.map((r) => (
                    <li key={r.id}>
                      <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={selected.includes(r.record)} onChange={() => toggle(r.record)} />
                        <span><span className="font-mono-ref text-xs">{r.recordReference}</span> {r.recordTitle}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={selected.length === 0}>Submit for approval</Button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
