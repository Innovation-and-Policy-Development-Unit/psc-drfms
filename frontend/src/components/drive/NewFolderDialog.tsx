import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus, X } from 'lucide-react'
import { driveApi, SERIES_CHANGED_EVENT, type RecordSeriesItem } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'

interface Props {
  /** Folder to create inside; defaults to the one being browsed. */
  parent?: string | null
  onClose: () => void
}

/** Creates a folder (a record series) and opens it. Officers work inside existing folders; administrators can also add top-level ones. */
export default function NewFolderDialog({ parent: initialParent, onClose }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'administrator'
  const [series, setSeries] = useState<RecordSeriesItem[] | null>(null)
  const [name, setName] = useState('')
  const [parent, setParent] = useState<string>(initialParent ?? '')
  const [years, setYears] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    driveApi.activeSeries(true).then(setSeries).catch(() => setError('Could not load the existing folders.'))
  }, [])

  // Depth-first, so children sit under their parent, indented
  const options = useMemo(() => {
    const byParent = new Map<number | null, RecordSeriesItem[]>()
    ;(series ?? []).forEach((s) => byParent.set(s.parent, [...(byParent.get(s.parent) ?? []), s]))
    const out: Array<RecordSeriesItem & { depth: number }> = []
    const walk = (p: number | null, depth: number) =>
      (byParent.get(p) ?? []).forEach((s) => { out.push({ ...s, depth }); walk(s.id, depth + 1) })
    walk(null, 0)
    return out
  }, [series])

  const needsParent = !isAdmin

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const retention = isAdmin && years.trim() !== '' ? Number(years) : undefined
      const { data } = await driveApi.newFolder(name.trim(), parent || null, retention)
      await driveApi.activeSeries(true)
      window.dispatchEvent(new Event(SERIES_CHANGED_EVENT))
      onClose()
      navigate(`/browse?record_series=${data.id}`)
    } catch (err) {
      setError(aiErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New folder">
      <form onSubmit={create} className="panel animate-registry-in w-full max-w-md space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><FolderPlus size={18} /> New folder</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>

        <div>
          <label htmlFor="folder-name" className="mb-1 block text-sm font-medium text-secondary">Name</label>
          <input id="folder-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} maxLength={255} placeholder="e.g. Leave applications" className="input w-full" />
        </div>

        <div>
          <label htmlFor="folder-parent" className="mb-1 block text-sm font-medium text-secondary">Create inside</label>
          <select id="folder-parent" value={parent} onChange={(e) => setParent(e.target.value)} className="input w-full" required={needsParent}>
            {isAdmin ? <option value="">Top level (no parent)</option> : <option value="" disabled>Choose a folder…</option>}
            {options.map((s) => (
              <option key={s.id} value={s.id}>{'  '.repeat(s.depth)}{s.code} — {s.name}</option>
            ))}
          </select>
        </div>

        {isAdmin ? (
          <div>
            <label htmlFor="folder-years" className="mb-1 block text-sm font-medium text-secondary">Retention (years)</label>
            <input id="folder-years" type="number" min={0} max={150} value={years} onChange={(e) => setYears(e.target.value)} placeholder="Inherit" className="input w-full" />
            <p className="mt-1 text-xs text-muted">Leave empty to inherit the retention of the folder above (7 years for a top-level folder).</p>
          </div>
        ) : (
          <p className="text-xs text-muted">The new folder inherits the retention period of the folder above it. Only an administrator can change retention.</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !name.trim() || (needsParent && !parent)}>{busy ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </div>
  )
}
