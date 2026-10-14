import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus2, X } from 'lucide-react'
import { featuresApi, type AttachmentRow } from '@/api/features'
import { driveApi, type RecordSeriesItem } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'
import { CLASSIFICATION_OPTIONS } from '@/lib/recordBadges'
import { Button } from '@/components/ui/Button'

interface Props {
  recordId: string
  attachment: AttachmentRow
  /** Classification of the record it is attached to; the new record starts there. */
  classification: string
  onClose: () => void
  onDone: () => void
}

/** An annex that needs its own classification or retention becomes a record in its own right, linked back as "annex of". */
export default function PromoteAttachmentDialog({ recordId, attachment, classification, onClose, onDone }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(attachment.fileName.replace(/\.[^.]+$/, ''))
  const [level, setLevel] = useState(classification)
  const [series, setSeries] = useState('')
  const [options, setOptions] = useState<RecordSeriesItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { driveApi.activeSeries().then(setOptions).catch(() => setOptions([])) }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await featuresApi.promoteAttachment(recordId, attachment.id, { title: title.trim(), classificationLevel: level, ...(series ? { recordSeries: series } : {}) })
      onDone()
      navigate(`/document/${data.id}`)
    } catch (err) { setError(aiErrorMessage(err)); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Make this its own record">
      <form onSubmit={create} className="panel animate-registry-in w-full max-w-md space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><FilePlus2 size={18} /> Make it its own record</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>
        <p className="text-sm text-muted">“{attachment.fileName}” becomes a separate record with its own classification and retention. It stays linked to this record as its annex, and is hidden from this record’s attachments.</p>
        <div>
          <label htmlFor="pr-title" className="mb-1 block text-sm font-medium">Title</label>
          <input id="pr-title" required maxLength={500} value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pr-level" className="mb-1 block text-sm font-medium">Classification</label>
            <select id="pr-level" value={level} onChange={(e) => setLevel(e.target.value)} className="input w-full">
              {[...CLASSIFICATION_OPTIONS, { value: 'secret', label: 'Secret' }].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pr-series" className="mb-1 block text-sm font-medium">Folder</label>
            <select id="pr-series" value={series} onChange={(e) => setSeries(e.target.value)} className="input w-full">
              <option value="">Same as this record</option>
              {options.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create record'}</Button>
        </div>
      </form>
    </div>
  )
}
