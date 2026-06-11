import { useState, useEffect, useCallback } from 'react'
import { complianceApi, unwrapList } from '@/api'
import type { LegalHold } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const HOLD_TYPES = [
  { value: 'disciplinary', label: 'Disciplinary' },
  { value: 'inquiry', label: 'Commission inquiry' },
  { value: 'litigation', label: 'Litigation' },
  { value: 'audit', label: 'Audit' },
  { value: 'other', label: 'Other' },
]

export default function LegalHolds() {
  const [holds, setHolds] = useState<LegalHold[]>([])
  const [selected, setSelected] = useState<LegalHold | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', reason: '', holdType: 'inquiry', recordIds: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await complianceApi.getLegalHolds()
      const list = unwrapList(data)
      setHolds(list)
      setSelected((prev) => list.find((h) => h.id === prev?.id) ?? list[0] ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const records = form.recordIds.split(/[\s,]+/).filter(Boolean)
    await complianceApi.createLegalHold({
      title: form.title,
      reason: form.reason,
      holdType: form.holdType,
      records,
    })
    setShowForm(false)
    setForm({ title: '', reason: '', holdType: 'inquiry', recordIds: '' })
    load()
  }

  const handleLift = async (id: string) => {
    if (!confirm('Lift this legal hold?')) return
    await complianceApi.liftLegalHold(id)
    load()
  }

  return (
    <PageShell
      title="Legal holds"
      subtitle="Freeze records from modification or destruction during inquiries, litigation, or audit."
      action={
        <Button onClick={() => setShowForm(true)}>Apply hold</Button>
      }
    >
      <div className="grid lg:grid-cols-[minmax(280px,360px)_1fr] gap-4 min-h-[480px]">
        <Panel className="p-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-registry label-overline">Active & past holds</div>
          {loading ? (
            <div className="p-4 space-y-3"><Skeleton lines={4} /><Skeleton lines={4} /></div>
          ) : holds.length === 0 ? (
            <EmptyState title="No legal holds" description="Apply a hold when records must be preserved." />
          ) : (
            <ul className="overflow-y-auto custom-scrollbar flex-1 divide-y divide-[var(--border-default)]">
              {holds.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(h)}
                    className={`w-full text-start px-4 py-3 transition-colors ${
                      selected?.id === h.id ? 'bg-[var(--surface-sunken)]' : 'hover:bg-[var(--surface-sunken)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{h.title}</span>
                      <Badge tone={h.isActive ? 'warning' : 'neutral'}>{h.isActive ? 'Active' : 'Lifted'}</Badge>
                    </div>
                    <p className="text-xs text-muted">{h.recordsCount} record(s) · {h.holdType}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          {!selected ? (
            <p className="text-sm text-muted">Select a hold to view details.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-lg font-semibold">{selected.title}</h2>
                  <p className="text-xs text-muted mt-1 font-mono-ref">{selected.id.slice(0, 8)}…</p>
                </div>
                {selected.isActive && (
                  <Button variant="secondary" size="sm" onClick={() => handleLift(selected.id)}>
                    Lift hold
                  </Button>
                )}
              </div>
              <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="label-overline mb-1">Type</dt><dd className="capitalize">{selected.holdType}</dd></div>
                <div><dt className="label-overline mb-1">Applied by</dt><dd>{selected.appliedByName ?? '—'}</dd></div>
                <div><dt className="label-overline mb-1">Applied</dt><dd>{new Date(selected.appliedAt).toLocaleString()}</dd></div>
                <div><dt className="label-overline mb-1">Records</dt><dd>{selected.recordsCount}</dd></div>
              </dl>
              <div>
                <p className="label-overline mb-2">Reason</p>
                <p className="text-sm text-secondary leading-relaxed">{selected.reason}</p>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <form onSubmit={handleCreate} className="panel w-full max-w-lg p-6 space-y-4 animate-registry-in">
            <h2 className="font-serif text-lg font-semibold">Apply legal hold</h2>
            <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Hold type</label>
              <select className="input" value={form.holdType} onChange={(e) => setForm({ ...form, holdType: e.target.value })}>
                {HOLD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Reason</label>
              <textarea className="input min-h-[80px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </div>
            <Input label="Record IDs" hint="Comma or space separated UUIDs" value={form.recordIds} onChange={(e) => setForm({ ...form, recordIds: e.target.value })} required />
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </div>
      )}
    </PageShell>
  )
}
