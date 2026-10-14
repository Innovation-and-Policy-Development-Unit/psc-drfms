import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { driveApi, type NewDocumentKind } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'
import { Button } from '@/components/ui/Button'

const LABELS: Record<NewDocumentKind, { noun: string; placeholder: string }> = {
  word: { noun: 'Word document', placeholder: 'Untitled document' },
  excel: { noun: 'Excel workbook', placeholder: 'Untitled workbook' },
  powerpoint: { noun: 'PowerPoint presentation', placeholder: 'Untitled presentation' },
}

interface Props {
  kind: NewDocumentKind
  recordSeries?: string | null
  onClose: () => void
}

/** Names a new blank document, creates it as a record, and opens it in the editor. */
export default function NewDocumentDialog({ kind, recordSeries, onClose }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { noun, placeholder } = LABELS[kind]

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await driveApi.newDocument(kind, title.trim() || placeholder, recordSeries ?? undefined)
      onClose()
      navigate(`/document/${data.id}`)
    } catch (err) {
      setError(aiErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`New ${noun}`}>
      <form onSubmit={create} className="panel animate-registry-in w-full max-w-md space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold">New {noun}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>
        <div>
          <label htmlFor="new-doc-title" className="mb-1 block text-sm font-medium text-secondary">Title</label>
          <input id="new-doc-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={placeholder} className="input w-full" />
          <p className="mt-1.5 text-xs text-muted">It is saved as a draft record you can edit in the browser, then classify and file.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create and open'}</Button>
        </div>
      </form>
    </div>
  )
}
