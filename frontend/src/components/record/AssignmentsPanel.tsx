import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, ClipboardCheck, RotateCcw, UserPlus, X } from 'lucide-react'
import clsx from 'clsx'
import { authApi } from '@/api'
import { featuresApi, type Assignment } from '@/api/features'
import { aiErrorMessage } from '@/api/ai'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/driveFormat'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

interface Person { id: number; email: string; fullName?: string; full_name?: string }

interface Props {
  recordId: string
  /** Records officers and above can assign work. */
  canAssign: boolean
  onChanged?: () => void
}

/** Ask a colleague to do something with this record by a date; they get a notification and see it in My Tasks. */
export default function AssignmentsPanel({ recordId, canAssign, onChanged }: Props) {
  const { user } = useAuth()
  const [rows, setRows] = useState<Assignment[] | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [adding, setAdding] = useState(false)
  const [who, setWho] = useState('')
  const [what, setWhat] = useState('')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(() => {
    featuresApi.recordAssignments(recordId).then(({ data }) => setRows(data.results)).catch((e) => { setRows([]); setError(aiErrorMessage(e)) })
  }, [recordId])
  useEffect(() => { setRows(null); load() }, [load])

  useEffect(() => {
    if (!adding || people.length) return
    authApi.getUsers({ page_size: '100' })
      .then(({ data }) => setPeople((data.results ?? data) as Person[]))
      .catch(() => setPeople([]))
  }, [adding, people.length])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await featuresApi.assign(recordId, { assignedTo: Number(who), instruction: what.trim(), ...(due ? { dueDate: due } : {}) })
      setAdding(false); setWho(''); setWhat(''); setDue('')
      load(); onChanged?.(); window.dispatchEvent(new Event('drfms:assignments-changed'))
    } catch (err) { setError(aiErrorMessage(err)) } finally { setBusy(false) }
  }

  const act = async (a: Assignment, action: 'complete' | 'reopen' | 'cancel') => {
    setError('')
    try { await featuresApi.assignmentAction(a.id, action); load(); onChanged?.(); window.dispatchEvent(new Event('drfms:assignments-changed')) } catch (err) { setError(aiErrorMessage(err)) }
  }

  const name = (p: Person) => p.fullName ?? p.full_name ?? p.email

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><ClipboardCheck size={16} /> Assignments</h3>
          <p className="mt-0.5 text-xs text-muted">Ask a colleague to do something with this record by a date.</p>
        </div>
        {canAssign && !adding && <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><UserPlus size={14} /> Assign</Button>}
      </div>

      {adding && (
        <form onSubmit={create} className="space-y-3 rounded-xl border border-[var(--border-default)] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <select value={who} onChange={(e) => setWho(e.target.value)} required className="input" aria-label="Assign to">
              <option value="">Choose a person…</option>
              {people.filter((p) => p.id !== user?.id).map((p) => <option key={p.id} value={p.id}>{name(p)}</option>)}
            </select>
            <input type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} className="input" aria-label="Due date" />
          </div>
          <input value={what} onChange={(e) => setWhat(e.target.value)} required maxLength={500} placeholder="What needs doing? e.g. Please review and confirm the figures" aria-label="Instruction" className="input w-full" />
          <p className="text-xs text-muted">They can only be assigned a record they are allowed to open. Share it with them first if needed.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setError('') }}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy || !who || !what.trim()}>{busy ? 'Assigning…' : 'Assign'}</Button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows === null ? <Skeleton lines={3} /> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-default)] p-6 text-center text-sm text-muted">No assignments on this record.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)]">
          {rows.map((a) => {
            const mine = a.assignedTo === user?.id
            const mineToCancel = a.assignedBy === user?.id || user?.role === 'administrator'
            return (
              <li key={a.id} className="flex items-start gap-3 p-3">
                <span className={clsx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white',
                  a.status === 'done' ? 'bg-emerald-500' : a.status === 'cancelled' ? 'bg-gray-400' : a.isOverdue ? 'bg-red-500' : 'bg-primary-500')}>
                  {a.status === 'done' ? <Check size={13} /> : a.status === 'cancelled' ? <X size={13} /> : <CalendarClock size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={clsx('text-sm', a.status !== 'open' && 'text-muted')}>{a.instruction}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {mine ? 'You' : a.assignedToName} · from {a.assignedByName || 'someone'}
                    {a.dueDate && <> · <span className={clsx(a.isOverdue && 'font-medium text-red-600')}>{a.isOverdue ? 'Overdue, was due' : 'due'} {formatDate(a.dueDate)}</span></>}
                    {a.status === 'done' && a.completedAt && <> · done {formatDate(a.completedAt)}</>}
                    {a.status === 'cancelled' && ' · cancelled'}
                  </p>
                  {a.completedNote && <p className="mt-0.5 text-xs text-muted">“{a.completedNote}”</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {a.status === 'open' && <button type="button" onClick={() => act(a, 'complete')} className="rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-[var(--surface-sunken)]">Mark done</button>}
                  {a.status !== 'open' && <button type="button" onClick={() => act(a, 'reopen')} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--surface-sunken)]"><RotateCcw size={12} /> Reopen</button>}
                  {a.status === 'open' && mineToCancel && <button type="button" onClick={() => act(a, 'cancel')} className="rounded px-2 py-1 text-xs text-muted hover:bg-[var(--surface-sunken)]">Cancel</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
