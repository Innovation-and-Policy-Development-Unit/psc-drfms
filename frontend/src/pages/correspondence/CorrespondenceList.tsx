import { useState, useEffect, useCallback } from 'react'
import { correspondenceApi, unwrapList } from '@/api'
import type { Correspondence } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const DIRECTION_TONE = { incoming: 'info', outgoing: 'success', internal: 'neutral' } as const

export default function CorrespondenceList() {
  const [items, setItems] = useState<Correspondence[]>([])
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    direction: 'incoming',
    subject: '',
    senderName: '',
    correspondenceDate: new Date().toISOString().slice(0, 10),
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = direction ? { direction } : undefined
      const { data } = await correspondenceApi.list(params)
      setItems(unwrapList(data))
    } finally {
      setLoading(false)
    }
  }, [direction])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await correspondenceApi.create(form)
    setShowForm(false)
    load()
  }

  return (
    <PageShell
      title="Correspondence register"
      subtitle="Incoming, outgoing, and internal correspondence with sequential reference numbering."
      action={<Button onClick={() => setShowForm(true)}>Register correspondence</Button>}
    >
      <div className="flex gap-2 mb-4">
        {['', 'incoming', 'outgoing', 'internal'].map((d) => (
          <button
            key={d || 'all'}
            type="button"
            onClick={() => setDirection(d)}
            className={`btn-sm px-3 py-1.5 border text-sm ${
              direction === d
                ? 'border-[var(--brand-navy)] bg-[var(--surface-sunken)] font-medium'
                : 'border-registry text-secondary hover:bg-[var(--surface-sunken)]'
            }`}
          >
            {d ? d.charAt(0).toUpperCase() + d.slice(1) : 'All'}
          </button>
        ))}
      </div>

      <Panel className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : items.length === 0 ? (
          <EmptyState title="No correspondence entries" description="Register incoming and outgoing correspondence here." />
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Direction</th>
                <th>Subject</th>
                <th>Party</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono-ref text-xs">{c.referenceNumber}</td>
                  <td>
                    <Badge tone={DIRECTION_TONE[c.direction] ?? 'neutral'}>{c.direction}</Badge>
                    {c.isEmailIngested && <span className="ms-1 text-[10px] text-muted">email</span>}
                  </td>
                  <td className="max-w-sm truncate text-[var(--text-primary)]">{c.subject}</td>
                  <td className="text-xs">{c.senderName || c.recipientName || '—'}</td>
                  <td className="text-xs text-muted">{c.correspondenceDate}</td>
                  <td className="capitalize text-xs">{c.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form onSubmit={handleCreate} className="panel w-full max-w-lg p-6 space-y-4 animate-registry-in">
            <h2 className="font-serif text-lg font-semibold">Register correspondence</h2>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Direction</label>
              <select className="input" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
                <option value="internal">Internal</option>
              </select>
            </div>
            <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            <Input label="Sender / party" value={form.senderName} onChange={(e) => setForm({ ...form, senderName: e.target.value })} />
            <Input label="Date" type="date" value={form.correspondenceDate} onChange={(e) => setForm({ ...form, correspondenceDate: e.target.value })} required />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Register</Button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
