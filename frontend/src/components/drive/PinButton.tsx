import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Pin, PinOff } from 'lucide-react'
import { driveApi, PINS_CHANGED_EVENT, type PinnedView, type PinSharing } from '@/api/drive'
import { useAuth } from '@/context/AuthContext'
import { aiErrorMessage } from '@/api/ai'

/** Pins the current view (including its filters) to the sidebar's Quick access. */
export function PinButton({ defaultLabel }: { defaultLabel: string }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.delete('page')
  const query = params.toString()
  const target = location.pathname + (query ? `?${query}` : '')

  const { user } = useAuth()
  const [pins, setPins] = useState<PinnedView[]>([])
  const [sharing, setSharing] = useState<PinSharing>('')
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(defaultLabel)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const pinned = pins.find((p) => p.target === target && p.own)

  const load = useCallback(() => {
    driveApi.pins().then(({ data }) => setPins(data)).catch(() => setPins([]))
  }, [])
  useEffect(() => {
    load()
    window.addEventListener(PINS_CHANGED_EVENT, load)
    return () => window.removeEventListener(PINS_CHANGED_EVENT, load)
  }, [load])

  useEffect(() => { setLabel(defaultLabel); setError('') }, [defaultLabel, target])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const changed = () => window.dispatchEvent(new Event(PINS_CHANGED_EVENT))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await driveApi.pin(label.trim() || defaultLabel, target, sharing)
      setOpen(false)
      changed()
    } catch (err) { setError(aiErrorMessage(err)) } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!pinned) return
    setBusy(true)
    try { await driveApi.unpin(pinned.id); changed() } finally { setBusy(false) }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => (pinned ? remove() : setOpen((o) => !o))}
        disabled={busy}
        aria-pressed={!!pinned}
        title={pinned ? 'Remove from Quick access' : 'Pin this view to Quick access'}
        className="btn-ghost btn-sm p-2"
      >
        {pinned ? <PinOff size={15} /> : <Pin size={15} />}
        <span className="sr-only">{pinned ? 'Unpin' : 'Pin to Quick access'}</span>
      </button>
      {open && (
        <form onSubmit={save} className="absolute end-0 top-full z-40 mt-1 w-64 space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 shadow-lg">
          <label className="block text-xs font-medium text-muted" htmlFor="pin-label">Name in Quick access</label>
          <input id="pin-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} className="input w-full" />
          <label className="block text-xs font-medium text-muted" htmlFor="pin-share">Who can see it</label>
          <select id="pin-share" value={sharing} onChange={(e) => setSharing(e.target.value as PinSharing)} className="input w-full">
            <option value="">Only me</option>
            {user?.department != null && <option value="department">My department</option>}
            {user?.role === 'administrator' && <option value="all">Everyone</option>}
          </select>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>Pin</button>
          </div>
        </form>
      )}
    </div>
  )
}
