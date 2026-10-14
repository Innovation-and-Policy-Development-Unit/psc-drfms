import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, X } from 'lucide-react'
import { driveApi, RECORDS_CHANGED_EVENT, RECORDS_DELETED_EVENT, type RecordsDeletedDetail } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'

const SHOW_MS = 10_000

/**
 * "Moved to the Recycle bin · Undo" message. Anything that deletes records announces it with
 * RECORDS_DELETED_EVENT; this shows the message for a few seconds and restores on Undo.
 */
export function UndoHost() {
  const [pending, setPending] = useState<RecordsDeletedDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const dismiss = useCallback(() => { clearTimeout(timer.current); setPending(null); setError('') }, [])

  useEffect(() => {
    const onDeleted = (e: Event) => {
      const detail = (e as CustomEvent<RecordsDeletedDetail>).detail
      if (!detail?.ids.length) return
      clearTimeout(timer.current)
      setError('')
      setPending(detail)
      timer.current = setTimeout(() => setPending(null), SHOW_MS)
    }
    window.addEventListener(RECORDS_DELETED_EVENT, onDeleted)
    return () => { window.removeEventListener(RECORDS_DELETED_EVENT, onDeleted); clearTimeout(timer.current) }
  }, [])

  if (!pending) return null

  const undo = async () => {
    setBusy(true)
    clearTimeout(timer.current)
    try {
      const { data } = await driveApi.restoreFromBin(pending.ids)
      if (data.failed.length) throw new Error(data.failed[0].detail)
      window.dispatchEvent(new Event(RECORDS_CHANGED_EVENT))
      setPending(null)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : aiErrorMessage(e))
    } finally { setBusy(false) }
  }

  const what = pending.ids.length === 1 ? `“${pending.title ?? 'Record'}”` : `${pending.ids.length} records`

  return (
    <div role="status" className="fixed bottom-14 start-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--border-default)] bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg rtl:translate-x-1/2">
      <Trash2 size={15} className="shrink-0 opacity-80" />
      <span className="min-w-0 truncate">{error || <>{what} moved to the <Link to="/bin" className="underline" onClick={dismiss}>Recycle bin</Link></>}</span>
      {!error && <button type="button" onClick={undo} disabled={busy} className="shrink-0 font-semibold text-primary-300 hover:underline disabled:opacity-60">{busy ? 'Restoring…' : 'Undo'}</button>}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}
