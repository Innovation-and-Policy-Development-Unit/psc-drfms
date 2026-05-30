import { useState, useEffect, useCallback } from 'react'
import { complianceApi, unwrapList } from '@/api'
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await complianceApi.createDestruction({ notes, destructionMethod: 'Digital deletion' })
    setShowForm(false)
    setNotes('')
    load()
  }

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    await complianceApi.approveDestruction(id, action)
    load()
  }

  return (
    <PageShell
      title="Destruction scheduling"
      subtitle="Formal approval chain and certificates for records past retention."
      action={<Button onClick={() => setShowForm(true)}>Request destruction</Button>}
    >
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
                        <Button size="sm" variant="secondary" onClick={() => handleApprove(c.id, 'approve')}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => handleApprove(c.id, 'reject')}>Reject</Button>
                      </div>
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
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Submit for approval</Button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
