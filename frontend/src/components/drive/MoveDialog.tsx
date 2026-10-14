import { useEffect, useMemo, useState } from 'react'
import { FolderInput, Folder, X } from 'lucide-react'
import { driveApi, type RecordSeriesItem } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'
import { Button } from '@/components/ui/Button'

interface Props {
  recordIds: string[]
  onClose: () => void
  onMoved: () => void
}

/** Pick a record series and file the selected records under it. */
export default function MoveDialog({ recordIds, onClose, onMoved }: Props) {
  const [series, setSeries] = useState<RecordSeriesItem[] | null>(null)
  const [target, setTarget] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    driveApi.series()
      .then(({ data }) => setSeries((Array.isArray(data) ? data : data.results).filter((s) => s.isActive)))
      .catch(() => setError('Could not load the record series.'))
  }, [])

  // Depth-first so children sit under their parent, indented
  const rows = useMemo(() => {
    if (!series) return []
    const byParent = new Map<number | null, RecordSeriesItem[]>()
    series.forEach((s) => byParent.set(s.parent, [...(byParent.get(s.parent) ?? []), s]))
    const out: Array<RecordSeriesItem & { depth: number }> = []
    const walk = (parent: number | null, depth: number) =>
      (byParent.get(parent) ?? []).forEach((s) => { out.push({ ...s, depth }); walk(s.id, depth + 1) })
    walk(null, 0)
    return out
  }, [series])

  const move = async () => {
    setBusy(true)
    setError('')
    try {
      await driveApi.moveRecords(recordIds, target || null)
      onMoved()
    } catch (e) {
      setError(aiErrorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Move records">
      <div className="panel animate-registry-in flex max-h-[80vh] w-full max-w-md flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <FolderInput size={18} /> Move {recordIds.length === 1 ? 'record' : `${recordIds.length} records`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>
        <p className="text-sm text-muted">Choose the record series to file them under. Retention dates are not changed by moving.</p>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--border-default)]">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-sunken)]">
            <input type="radio" name="series" checked={target === ''} onChange={() => setTarget('')} />
            <span className="text-muted">No series</span>
          </label>
          {series === null && !error && <p className="px-3 py-4 text-sm text-muted">Loading…</p>}
          {rows.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-sunken)]" style={{ paddingInlineStart: `${0.75 + s.depth * 1.25}rem` }}>
              <input type="radio" name="series" checked={target === String(s.id)} onChange={() => setTarget(String(s.id))} />
              <Folder size={14} className="shrink-0 text-muted" />
              <span className="truncate">{s.code} — {s.name}</span>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={move} disabled={busy || series === null}>{busy ? 'Moving…' : 'Move here'}</Button>
        </div>
      </div>
    </div>
  )
}
