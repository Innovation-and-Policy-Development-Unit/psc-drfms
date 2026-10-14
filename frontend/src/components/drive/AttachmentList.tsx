import { useEffect, useState } from 'react'
import { Download, Eye } from 'lucide-react'
import clsx from 'clsx'
import { featuresApi, saveBlob, type AttachmentRow } from '@/api/features'
import { aiErrorMessage } from '@/api/ai'
import { formatFileSize, getFileTypeInfo } from '@/utils/fileType'
import AttachmentPreview from '@/components/record/AttachmentPreview'

interface Props {
  recordId: string
  /** "row" nests under a list row; "pane" fits the details pane. */
  variant?: 'row' | 'pane'
}

/** A record's attachments, loaded when first shown, each one previewable or downloadable. */
export function AttachmentList({ recordId, variant = 'row' }: Props) {
  const [rows, setRows] = useState<AttachmentRow[] | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<AttachmentRow | null>(null)

  useEffect(() => {
    let live = true
    featuresApi.attachments(recordId)
      .then(({ data }) => { if (live) setRows(data.results) })
      .catch((e) => { if (live) { setRows([]); setError(aiErrorMessage(e)) } })
    return () => { live = false }
  }, [recordId])

  const download = async (a: AttachmentRow) => {
    try { const { data } = await featuresApi.downloadAttachment(recordId, a.id); saveBlob(data, a.fileName) } catch (e) { setError(aiErrorMessage(e)) }
  }

  if (rows === null) return <p className="px-3 py-2 text-xs text-muted">Loading attachments…</p>
  return (
    <>
      {error && <p className="px-3 py-1 text-xs text-red-600">{error}</p>}
      <ul className={clsx(variant === 'row' ? 'space-y-0.5 py-1' : 'space-y-1')}>
        {rows.map((a) => {
          const info = getFileTypeInfo(a.mimeType, a.fileName)
          const Icon = info.Icon
          return (
            <li key={a.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-[var(--surface-sunken)]">
              <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded', info.light)}><Icon size={13} /></span>
              <button type="button" onClick={() => setPreview(a)} className="min-w-0 flex-1 truncate text-start hover:underline" title={`Preview ${a.fileName}`}>{a.fileName}</button>
              <span className="shrink-0 text-xs text-muted">{formatFileSize(a.fileSize)}</span>
              <button type="button" onClick={() => setPreview(a)} aria-label={`Preview ${a.fileName}`} className="rounded p-1 text-gray-500 hover:bg-[var(--surface-raised)]"><Eye size={13} /></button>
              <button type="button" onClick={() => download(a)} aria-label={`Download ${a.fileName}`} className="rounded p-1 text-gray-500 hover:bg-[var(--surface-raised)]"><Download size={13} /></button>
            </li>
          )
        })}
      </ul>
      {preview && <AttachmentPreview recordId={recordId} attachment={preview} onClose={() => setPreview(null)} />}
    </>
  )
}
