import { useState, useRef, FormEvent, DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import clsx from 'clsx'
import { recordsApi } from '@/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  CLASSIFICATION_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
} from '@/lib/recordBadges'

export default function RecordUpload() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file to upload.')
      return
    }
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.append('file', file)
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) fd.append(k, String(v))
    })

    try {
      const { data } = await recordsApi.createRecord(fd)
      navigate(`/document/${data.id}`)
    } catch (err) {
      if (isAxiosError(err)) {
        setError(String(err.response?.data?.detail ?? JSON.stringify(err.response?.data) ?? 'Upload failed.'))
      } else {
        setError('Upload failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell
      title="Upload record"
      subtitle="Add a file to the registry. OCR and indexing run automatically."
    >
      {error && <div className="alert-danger text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <div
          role="button"
          tabIndex={0}
          className={clsx(
            'panel border-2 border-dashed text-center cursor-pointer py-10 p-4',
            dragging ? 'border-[var(--brand-navy)] bg-[var(--surface-sunken)]' : 'border-registry',
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click() }}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tiff"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="space-y-1">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="btn-ghost btn-sm mt-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <p className="text-secondary">Drop a file here or click to browse</p>
              <p className="text-xs text-muted mt-1">PDF, Word, TIFF, JPG, PNG</p>
            </div>
          )}
        </div>

        <Panel className="space-y-4">
          <h2 className="font-serif text-base font-semibold">Record metadata</h2>

          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Document title"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-overline block mb-2">Document type</label>
              <select
                className="input"
                value={form.document_type}
                onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))}
              >
                {DOCUMENT_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-overline block mb-2">Classification</label>
              <select
                className="input"
                value={form.classification_level}
                onChange={(e) => setForm((f) => ({ ...f, classification_level: e.target.value }))}
              >
                {CLASSIFICATION_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Originating ministry"
              value={form.originating_ministry}
              onChange={(e) => setForm((f) => ({ ...f, originating_ministry: e.target.value }))}
              placeholder="e.g. Ministry of Finance"
            />
            <Input
              label="Document date"
              type="date"
              value={form.document_date}
              onChange={(e) => setForm((f) => ({ ...f, document_date: e.target.value }))}
            />
          </div>

          <Input
            label="Physical file reference"
            value={form.physical_file_ref}
            onChange={(e) => setForm((f) => ({ ...f, physical_file_ref: e.target.value }))}
            placeholder="e.g. Box 12, Shelf C3"
          />

          <div>
            <label className="label-overline block mb-2">Description</label>
            <textarea
              rows={3}
              className="input resize-none"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description…"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-sm text-secondary">
            <input
              type="checkbox"
              checked={form.is_vital}
              onChange={(e) => setForm((f) => ({ ...f, is_vital: e.target.checked }))}
              className="mt-1"
            />
            Mark as vital record (excluded from automated retention/destruction)
          </label>
        </Panel>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Uploading…' : 'Upload record'}</Button>
        </div>
      </form>
    </PageShell>
  )
}
