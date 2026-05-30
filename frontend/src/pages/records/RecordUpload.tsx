import { useState, useRef, FormEvent, DragEvent, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UploadCloud, X, FileUp } from 'lucide-react'
import clsx from 'clsx'
import { useDriveUI } from '@/context/DriveUIContext'
import { useTransfers } from '@/context/TransferContext'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatFileSize } from '@/utils/fileType'
import {
  CLASSIFICATION_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
} from '@/lib/recordBadges'

export default function RecordUpload() {
  const navigate = useNavigate()
  const { consumePendingUploadFile, openUploadDialog } = useDriveUI()
  const { queueUpload } = useTransfers()
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    document_type: 'other',
    classification_level: 'internal',
    originating_ministry: '',
    document_date: '',
    physical_file_ref: '',
    is_vital: false,
    change_summary: 'Initial upload',
  })

  useEffect(() => {
    const pending = consumePendingUploadFile()
    if (pending) setFiles([pending])
  }, [consumePendingUploadFile])

  const addFiles = (list: FileList | File[]) => {
    setFiles((prev) => [...prev, ...Array.from(list)])
    if (!form.title && list[0]) {
      setForm((f) => ({ ...f, title: list[0].name.replace(/\.[^.]+$/, '') }))
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return

    const metadata = {
      title: form.title || undefined,
      description: form.description,
      document_type: form.document_type,
      classification_level: form.classification_level,
      originating_ministry: form.originating_ministry,
      document_date: form.document_date,
      physical_file_ref: form.physical_file_ref,
      is_vital: form.is_vital,
      change_summary: form.change_summary,
    }

    if (files.length === 1) {
      queueUpload(files[0], { ...metadata, title: form.title || files[0].name.replace(/\.[^.]+$/, '') })
    } else {
      files.forEach((file) => queueUpload(file, metadata))
    }

    navigate('/browse')
  }

  return (
    <PageShell
      title="Upload"
      breadcrumbs={[{ label: 'Upload' }]}
      action={
        <button type="button" className="btn-ghost btn-sm" onClick={() => openUploadDialog()}>
          Quick upload dialog
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div
          className={clsx('mega-upload-page-zone', dragging && 'dragging')}
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
          <UploadCloud size={56} strokeWidth={1.25} className="mega-upload-cloud" />
          <p className="font-medium text-lg mt-4">Select files to upload</p>
          <p className="text-sm text-muted mt-1">or drag and drop into Cloud Drive</p>
        </div>

        {files.length > 0 && (
          <Panel className="p-0 mb-6 overflow-hidden">
            <div className="px-4 py-2 border-b border-registry label-overline">Upload queue</div>
            <ul>
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="mega-upload-queue-item mx-2 my-1">
                  <FileUp size={16} className="text-muted shrink-0" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted tabular-nums">{formatFileSize(f.size)}</span>
                  <button type="button" className="transfer-icon-btn" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel className="space-y-4">
          <h2 className="font-semibold text-sm">Record metadata {files.length > 1 && '(applied to all files)'}</h2>

          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={files[0]?.name.replace(/\.[^.]+$/, '') ?? 'Document title'}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-overline block mb-2">Document type</label>
              <select className="input" value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}>
                {DOCUMENT_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-overline block mb-2">Classification</label>
              <select className="input" value={form.classification_level} onChange={(e) => setForm((f) => ({ ...f, classification_level: e.target.value }))}>
                {CLASSIFICATION_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Originating ministry" value={form.originating_ministry} onChange={(e) => setForm((f) => ({ ...f, originating_ministry: e.target.value }))} />
            <Input label="Document date" type="date" value={form.document_date} onChange={(e) => setForm((f) => ({ ...f, document_date: e.target.value }))} />
          </div>

          <Input label="Physical file reference" value={form.physical_file_ref} onChange={(e) => setForm((f) => ({ ...f, physical_file_ref: e.target.value }))} />

          <div>
            <label className="label-overline block mb-2">Description</label>
            <textarea rows={3} className="input resize-none" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-sm text-secondary">
            <input type="checkbox" checked={form.is_vital} onChange={(e) => setForm((f) => ({ ...f, is_vital: e.target.checked }))} className="mt-1" />
            Mark as vital record
          </label>
        </Panel>

        <div className="flex gap-3 justify-end mt-6">
          <Link to="/browse" className="btn-secondary btn-sm">Cancel</Link>
          <Button type="submit" disabled={files.length === 0}>
            Upload {files.length > 0 ? `(${files.length})` : ''}
          </Button>
        </div>
      </form>
    </PageShell>
  )
}
