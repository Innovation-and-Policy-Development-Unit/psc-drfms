import { useState, useRef, DragEvent, FormEvent, useEffect } from 'react'
import { UploadCloud, X, FileUp } from 'lucide-react'
import clsx from 'clsx'
import { useTransfers } from '@/context/TransferContext'
import { Button } from '@/components/ui/Button'
import { formatFileSize } from '@/utils/fileType'

interface MegaUploadDialogProps {
  open: boolean
  onClose: () => void
  initialFiles?: File[]
}

export default function MegaUploadDialog({ open, onClose, initialFiles = [] }: MegaUploadDialogProps) {
  const { queueUpload } = useTransfers()
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [showMeta, setShowMeta] = useState(false)
  const [meta, setMeta] = useState({
    classification_level: 'internal',
    document_type: 'other',
    originating_ministry: '',
  })

  useEffect(() => {
    if (open && initialFiles.length) setFiles(initialFiles)
    if (!open) setFiles([])
  }, [open, initialFiles])

  if (!open) return null

  const addFiles = (list: FileList | File[]) => {
    setFiles((prev) => [...prev, ...Array.from(list)])
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const handleUpload = (e: FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return
    files.forEach((file) => {
      queueUpload(file, {
        ...meta,
        title: file.name.replace(/\.[^.]+$/, ''),
      })
    })
    setFiles([])
    onClose()
  }

  return (
    <div className="mega-dialog-backdrop" onClick={onClose}>
      <div className="mega-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="upload-title">
        <header className="mega-dialog-header">
          <h2 id="upload-title" className="text-base font-semibold">Upload to Cloud Drive</h2>
          <button type="button" className="transfer-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleUpload} className="mega-dialog-body">
          <div
            className={clsx('mega-upload-zone', dragging && 'dragging')}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tiff"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <UploadCloud size={48} strokeWidth={1.25} className="mega-upload-cloud" />
            <p className="font-medium mt-3">Drop files here or click to browse</p>
            <p className="text-xs text-muted mt-1">PDF, Word, images — multiple files supported</p>
          </div>

          {files.length > 0 && (
            <ul className="mega-upload-queue">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="mega-upload-queue-item">
                  <FileUp size={16} className="shrink-0 text-muted" />
                  <span className="flex-1 truncate text-sm">{f.name}</span>
                  <span className="text-xs text-muted tabular-nums">{formatFileSize(f.size)}</span>
                  <button
                    type="button"
                    className="transfer-icon-btn"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="text-xs hover:underline mt-3"
            style={{ color: 'var(--brand-mega)' }}
            onClick={() => setShowMeta((s) => !s)}
          >
            {showMeta ? 'Hide default metadata' : 'Set default metadata for all files'}
          </button>

          {showMeta && (
            <div className="grid sm:grid-cols-2 gap-3 mt-3 p-3 rounded border border-registry bg-[var(--surface-sunken)]">
              <div>
                <label className="label-overline block mb-1">Classification</label>
                <select className="input h-9 text-sm" value={meta.classification_level} onChange={(e) => setMeta((m) => ({ ...m, classification_level: e.target.value }))}>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="secret">Secret</option>
                </select>
              </div>
              <div>
                <label className="label-overline block mb-1">Document type</label>
                <select className="input h-9 text-sm" value={meta.document_type} onChange={(e) => setMeta((m) => ({ ...m, document_type: e.target.value }))}>
                  <option value="other">Other</option>
                  <option value="correspondence">Correspondence</option>
                  <option value="policy">Policy</option>
                  <option value="report">Report</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label-overline block mb-1">Originating ministry</label>
                <input className="input h-9 text-sm" value={meta.originating_ministry} onChange={(e) => setMeta((m) => ({ ...m, originating_ministry: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
          )}

          <footer className="mega-dialog-footer">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={files.length === 0}>
              Upload {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : ''}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  )
}
