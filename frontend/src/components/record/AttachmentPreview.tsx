import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { featuresApi, saveBlob, type AttachmentRow } from '@/api/features'
import { aiErrorMessage } from '@/api/ai'
import { formatFileSize } from '@/utils/fileType'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

type Kind = 'pdf' | 'image' | 'text' | 'other'
const MAX_TEXT_CHARS = 200_000

export function previewKind(mime: string, name: string): Kind {
  const m = mime.toLowerCase()
  const n = name.toLowerCase()
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf'
  if (m.startsWith('image/') && m !== 'image/tiff') return 'image'  // browsers cannot draw TIFF
  if (m === 'text/plain' || m === 'text/csv' || n.endsWith('.txt') || n.endsWith('.csv')) return 'text'
  return 'other'
}

interface Props { recordId: string; attachment: AttachmentRow; onClose: () => void }

/** Look at an attachment without downloading it: PDFs, images and text open here; other types offer a download. */
export default function AttachmentPreview({ recordId, attachment, onClose }: Props) {
  const kind = previewKind(attachment.mimeType, attachment.fileName)
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl: string | undefined
    let live = true
    featuresApi.downloadAttachment(recordId, attachment.id, true)
      .then(async ({ data }) => {
        if (!live) return
        setBlob(data)
        if (kind === 'text') setText((await data.text()).slice(0, MAX_TEXT_CHARS))
        else if (kind !== 'other') { objectUrl = URL.createObjectURL(data); setUrl(objectUrl) }
      })
      .catch((e) => { if (live) setError(aiErrorMessage(e)) })
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [recordId, attachment.id, kind])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Preview of ${attachment.fileName}`} onClick={onClose}>
      <div className="panel flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{attachment.fileName}</p>
            <p className="text-xs text-muted">{formatFileSize(attachment.fileSize)}</p>
          </div>
          <Button size="sm" variant="secondary" disabled={!blob} onClick={() => blob && saveBlob(blob, attachment.fileName)}><Download size={14} /> Download</Button>
          <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-sunken)]">
          {error ? <p className="p-6 text-sm text-red-600">{error}</p>
            : kind === 'other' ? <p className="p-10 text-center text-sm text-muted">This kind of file can’t be previewed here. Download it to open it.</p>
            : kind === 'text' ? <pre className="whitespace-pre-wrap break-words p-5 font-mono text-xs">{blob ? text : 'Loading…'}</pre>
            : !url ? <div className="p-6"><Skeleton lines={6} /></div>
            : kind === 'pdf' ? <iframe title={attachment.fileName} src={url} className="h-full w-full border-0" />
            : <img src={url} alt={attachment.fileName} className="mx-auto max-h-full max-w-full object-contain p-4" />}
        </div>
      </div>
    </div>
  )
}
