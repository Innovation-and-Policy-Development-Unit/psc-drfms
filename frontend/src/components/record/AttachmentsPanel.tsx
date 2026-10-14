import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileDown, Paperclip, RotateCcw, Trash2, Upload } from 'lucide-react'
import clsx from 'clsx'
import { featuresApi, readableError, saveBlob, type AttachmentRow } from '@/api/features'
import { aiErrorMessage } from '@/api/ai'
import { formatFileSize, getFileTypeInfo } from '@/utils/fileType'
import { formatDate } from '@/lib/driveFormat'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

interface Props {
  recordId: string
  canEdit: boolean
  /** Latest version of the main file, for the "PDF copy" actions. */
  mainFile?: { versionId: number | string; fileName: string; mimeType?: string }
  onChanged?: () => void
}

/** Extra files that belong with the record (annexes, enclosures, a PDF copy), separate from the versions of the main file. */
export default function AttachmentsPanel({ recordId, canEdit, mainFile, onChanged }: Props) {
  const [rows, setRows] = useState<AttachmentRow[] | null>(null)
  const [showRemoved, setShowRemoved] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    featuresApi.attachments(recordId, showRemoved && canEdit)
      .then(({ data }) => setRows(data.results))
      .catch((e) => { setRows([]); setError(aiErrorMessage(e)) })
  }, [recordId, showRemoved, canEdit])
  useEffect(() => { setRows(null); load() }, [load])

  const run = async (key: string, job: () => Promise<unknown>, done?: string) => {
    setBusy(key)
    setError('')
    setNotice('')
    try { await job(); if (done) setNotice(done); load(); onChanged?.() } catch (e) { setError(await readableError(e, aiErrorMessage(e))) } finally { setBusy(null) }
  }

  const upload = (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length) void run('upload', () => featuresApi.uploadAttachments(recordId, list), `Added ${list.length} ${list.length === 1 ? 'file' : 'files'}.`)
  }

  const download = (a: AttachmentRow) => run(`dl${a.id}`, async () => {
    const { data } = await featuresApi.downloadAttachment(recordId, a.id)
    saveBlob(data, a.fileName)
  })

  const isOffice = !!mainFile && !!getFileTypeInfo(mainFile.mimeType, mainFile.fileName).officeType

  const pdfDownload = () => run('pdf-dl', async () => {
    const res = await featuresApi.convertToPdf(recordId, mainFile!.versionId, 'download')
    saveBlob(res.data as Blob, `${mainFile!.fileName.replace(/\.[^.]+$/, '')}.pdf`)
  })

  const pdfSave = () => run('pdf-save', () => featuresApi.convertToPdf(recordId, mainFile!.versionId, 'save'), 'Saved a PDF copy.')

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Paperclip size={16} /> Attachments</h3>
          <p className="mt-0.5 text-xs text-muted">Annexes and enclosures that go with this record. New versions of the main file are in Versions.</p>
        </div>
        {canEdit && (
          <>
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => input.current?.click()}><Upload size={14} /> Add files</Button>
            <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = '' }} />
          </>
        )}
      </div>

      {isOffice && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-sunken)] p-3 text-sm">
          <FileDown size={16} className="shrink-0 text-muted" />
          <span className="flex-1 text-muted">Make a PDF of {mainFile!.fileName}</span>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={pdfDownload}>{busy === 'pdf-dl' ? 'Converting…' : 'Download as PDF'}</Button>
          {canEdit && <Button size="sm" variant="secondary" disabled={busy !== null} onClick={pdfSave}>{busy === 'pdf-save' ? 'Converting…' : 'Save a PDF copy here'}</Button>}
        </div>
      )}

      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); upload(e.dataTransfer.files) }}
          className={clsx('rounded-xl border-2 border-dashed p-4 text-center text-xs text-muted transition-colors', dragging ? 'border-[var(--brand-primary)] bg-[var(--surface-sunken)]' : 'border-[var(--border-default)]')}
        >
          Drop files here to attach them
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {rows === null ? <Skeleton lines={3} /> : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-default)] p-6 text-center text-sm text-muted">No attachments.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-default)] rounded-xl border border-[var(--border-default)]">
          {rows.map((a) => {
            const info = getFileTypeInfo(a.mimeType, a.fileName)
            const Icon = info.Icon
            return (
              <li key={a.id} className={clsx('flex items-center gap-3 p-3', a.removed && 'opacity-60')}>
                <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', info.light)}><Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className={clsx('truncate text-sm font-medium', a.removed && 'line-through')}>{a.fileName}</p>
                  <p className="text-xs text-muted">
                    {formatFileSize(a.fileSize)} · {formatDate(a.createdAt)}{a.uploadedByName ? ` · ${a.uploadedByName}` : ''}
                    {a.role === 'pdf_copy' && <span className="ms-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">PDF copy</span>}
                    {a.description && a.role !== 'pdf_copy' ? ` · ${a.description}` : ''}
                  </p>
                </div>
                {!a.removed && <button type="button" onClick={() => download(a)} disabled={busy !== null} aria-label={`Download ${a.fileName}`} className="rounded p-1.5 text-gray-500 hover:bg-[var(--surface-sunken)]"><Download size={15} /></button>}
                {canEdit && (a.removed ? (
                  <button type="button" onClick={() => run(`r${a.id}`, () => featuresApi.attachmentAction(recordId, a.id, 'restore'))} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-[var(--surface-sunken)]"><RotateCcw size={13} /> Restore</button>
                ) : (
                  <button type="button" onClick={() => run(`x${a.id}`, () => featuresApi.attachmentAction(recordId, a.id, 'remove'))} disabled={busy !== null} aria-label={`Remove ${a.fileName}`} title="Hide this file (it can be restored)" className="rounded p-1.5 text-gray-400 hover:bg-[var(--surface-sunken)] hover:text-red-600"><Trash2 size={15} /></button>
                ))}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && (
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" className="rounded-sm" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> Show removed files
        </label>
      )}
    </div>
  )
}
