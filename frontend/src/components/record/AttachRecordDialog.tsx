import { useEffect, useRef, useState } from 'react'
import { Merge, Search, X } from 'lucide-react'
import { featuresApi } from '@/api/features'
import { searchApi, type SearchSuggestion } from '@/api'
import { aiErrorMessage } from '@/api/ai'
import { Button } from '@/components/ui/Button'

interface Props { recordId: string; onClose: () => void; onDone: () => void }

/** Fold another record into this one: its file (and any attachments) are copied here and the record moves to the Recycle bin. */
export default function AttachRecordDialog({ recordId, onClose, onDone }: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchSuggestion[]>([])
  const [chosen, setChosen] = useState<SearchSuggestion | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abort = useRef<AbortController>()

  useEffect(() => {
    const q = query.trim()
    if (chosen || q.length < 2) { setHits([]); return }
    const t = setTimeout(() => {
      abort.current?.abort()
      abort.current = new AbortController()
      searchApi.suggest(q, abort.current.signal).then(({ data }) => setHits(data.filter((h) => h.id !== recordId))).catch(() => { /* keep the list */ })
    }, 200)
    return () => clearTimeout(t)
  }, [query, chosen, recordId])

  const attach = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chosen) return
    setBusy(true)
    setError('')
    try { await featuresApi.attachRecord(recordId, chosen.id); onDone(); onClose() } catch (err) { setError(aiErrorMessage(err)); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Attach an existing record">
      <form onSubmit={attach} className="panel animate-registry-in w-full max-w-md space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Merge size={18} /> Attach an existing record</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>
        <p className="text-sm text-muted">Use this when a separate record really belongs inside this one, such as an annex that was filed on its own.</p>

        {chosen ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
            <span className="min-w-0 truncate"><span className="font-mono-ref text-xs text-muted">{chosen.referenceNumber}</span> {chosen.title}</span>
            <button type="button" onClick={() => { setChosen(null); setQuery('') }} aria-label="Choose a different record" className="shrink-0 rounded p-1 hover:bg-[var(--surface-raised)]"><X size={14} /></button>
          </div>
        ) : (
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for the record by title or reference…" aria-label="Find the record to attach" className="input w-full ps-9" />
            {hits.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] py-1 shadow-lg">
                {hits.map((h) => (
                  <li key={h.id}><button type="button" onClick={() => { setChosen(h); setHits([]) }} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-[var(--surface-sunken)]">
                    <span className="font-mono-ref shrink-0 text-xs text-muted">{h.referenceNumber}</span><span className="min-w-0 flex-1 truncate">{h.title}</span></button></li>
                ))}
              </ul>
            )}
          </div>
        )}

        {chosen && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            Its file and attachments are copied here, and {chosen.referenceNumber} moves to the Recycle bin, marked as attached to this record. It can be restored from there, but then a copy would exist in both places.
            Records under legal hold or marked vital cannot be attached, and neither can one classified higher than this record.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!chosen || busy}>{busy ? 'Attaching…' : 'Attach'}</Button>
        </div>
      </form>
    </div>
  )
}
