import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { recordsApi } from '../../api'
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react'

const DOCUMENT_TYPES = [
  ['correspondence', 'Correspondence'],
  ['personnel_file', 'Personnel File'],
  ['board_paper', 'Board Paper'],
  ['policy', 'Policy Document'],
  ['circular', 'Circular'],
  ['report', 'Report'],
  ['submission', 'Commission Submission'],
  ['disciplinary', 'Disciplinary File'],
  ['contract', 'Contract'],
  ['financial', 'Financial Document'],
  ['legal', 'Legal Document'],
  ['other', 'Other'],
]

const CLASSIFICATIONS = [
  ['unclassified', 'Unclassified'],
  ['internal', 'Internal'],
  ['confidential', 'Confidential'],
  ['restricted', 'Restricted'],
]

export default function RecordUpload() {
  const navigate = useNavigate()
  const fileRef = useRef()
  const [file, setFile] = useState(null)
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

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) setFile(dropped)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) { setError('Please select a file to upload.'); return }
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.append('file', file)
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) fd.append(k, v)
    })

    try {
      const { data } = await recordsApi.createRecord(fd)
      navigate(`/records/${data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Record</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Upload a new document. OCR and AI metadata tagging will process automatically.</p>
      </div>

      {error && (
        <div className="alert-danger">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragging ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-primary-300'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tiff" onChange={e => setFile(e.target.files[0])} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={24} className="text-primary-600" />
              <span className="font-medium text-slate-900 dark:text-white">{file.name}</span>
              <span className="text-sm text-slate-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              <button type="button" onClick={e => { e.stopPropagation(); setFile(null) }} className="text-red-500 hover:text-red-600">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={32} className="mx-auto text-slate-400 mb-3" />
              <p className="text-slate-600 dark:text-slate-400">Drop a file here or <span className="text-primary-600 font-medium">browse</span></p>
              <p className="text-xs text-slate-400 mt-1">PDF, Word, TIFF, JPG, PNG</p>
            </div>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-slate-900 dark:text-white">Record Metadata</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input type="text" className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Document Type</label>
              <select className="input" value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}>
                {DOCUMENT_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Classification</label>
              <select className="input" value={form.classification_level} onChange={e => setForm(f => ({ ...f, classification_level: e.target.value }))}>
                {CLASSIFICATIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Originating Ministry</label>
              <input type="text" className="input" value={form.originating_ministry} onChange={e => setForm(f => ({ ...f, originating_ministry: e.target.value }))} placeholder="e.g. Ministry of Finance" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Document Date</label>
              <input type="date" className="input" value={form.document_date} onChange={e => setForm(f => ({ ...f, document_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Physical File Reference</label>
            <input type="text" className="input" value={form.physical_file_ref} onChange={e => setForm(f => ({ ...f, physical_file_ref: e.target.value }))} placeholder="e.g. Box 12, Shelf C3" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea rows={3} className="input resize-none" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the document…" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_vital} onChange={e => setForm(f => ({ ...f, is_vital: e.target.checked }))} className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-700 dark:text-slate-300">Mark as Vital Record (excluded from automated retention/destruction)</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Uploading…' : <><Upload size={16} /> Upload Record</>}
          </button>
        </div>
      </form>
    </div>
  )
}
