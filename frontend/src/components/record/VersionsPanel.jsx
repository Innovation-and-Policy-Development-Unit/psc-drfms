import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { recordsApi } from '../../api'
import { formatFileSize, getFileTypeInfo } from '../../utils/fileType'
import { Upload, Download, Clock, GitCompare, Check, X } from 'lucide-react'

export default function VersionsPanel({ recordId, onVersionChange }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [compareIds, setCompareIds] = useState([])
  const [diff, setDiff] = useState(null)
  const [summary, setSummary] = useState('')
  const fileRef = useRef()

  const load = () => {
    recordsApi.getVersions(recordId)
      .then(({ data }) => {
        const list = data.results || data
        setVersions(list)
        if (!selectedId && list.length) setSelectedId(list[0].id)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [recordId])

  const selected = versions.find(v => v.id === selectedId)
  const latestId = versions[0]?.id

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('change_summary', summary || 'New version uploaded')
    try {
      await recordsApi.uploadVersion(recordId, fd)
      setSummary('')
      load()
      onVersionChange?.()
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDownload = async (v) => {
    const { data } = await recordsApi.downloadVersion(recordId, v.id, false)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = v.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleCompare = (id) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
    setDiff(null)
  }

  const runCompare = async () => {
    if (compareIds.length !== 2) return
    const { data } = await recordsApi.getVersionDiff(recordId, compareIds[1], compareIds[0])
    setDiff(data)
  }

  if (loading) return <div className="p-4 skeleton h-40 rounded-lg" />

  return (
    <div className="flex h-full min-h-[400px]">
      <div className="w-full lg:w-80 shrink-0 border-e border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50/50 dark:bg-slate-900/30">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Version history</h3>
          <input
            type="text"
            className="input text-sm w-full"
            placeholder="Change summary (optional)"
            value={summary}
            onChange={e => setSummary(e.target.value)}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-sm btn-primary w-full">
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload new version'}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          {compareIds.length === 2 && (
            <button type="button" onClick={runCompare} className="btn-sm btn-outline w-full">
              <GitCompare size={14} /> Compare selected
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {versions.map(v => {
            const { Icon, color } = getFileTypeInfo(v.mime_type, v.file_name)
            const isLatest = v.id === latestId
            const inCompare = compareIds.includes(v.id)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                className={clsx(
                  'w-full flex items-start gap-2 p-2.5 rounded-lg text-start transition-colors border',
                  selectedId === v.id
                    ? 'border-primary-300 bg-white dark:bg-slate-800 shadow-sm'
                    : 'border-transparent hover:bg-white/80 dark:hover:bg-slate-800/50'
                )}
              >
                <div className={clsx('w-8 h-8 rounded flex items-center justify-center text-white shrink-0 mt-0.5', color)}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    v{v.version_number}
                    {isLatest && <span className="ms-1 text-[10px] text-primary-600 font-semibold">CURRENT</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{v.file_name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> {new Date(v.created_at).toLocaleString()}
                  </p>
                </div>
                <span
                  role="checkbox"
                  aria-checked={inCompare}
                  onClick={e => { e.stopPropagation(); toggleCompare(v.id) }}
                  className={clsx(
                    'shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-1',
                    inCompare ? 'bg-primary-600 border-primary-600 text-white' : 'border-slate-300'
                  )}
                >
                  {inCompare && <Check size={12} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {diff ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Text diff (OCR)</h4>
              <button type="button" onClick={() => setDiff(null)} className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
            </div>
            <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-[60vh] font-mono">
              {(diff.diff || []).join('\n') || 'No OCR text to compare.'}
            </pre>
          </div>
        ) : selected ? (
          <div className="max-w-xl space-y-4">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                Version {selected.version_number}
              </p>
              <p className="text-sm text-slate-500 mt-1">{selected.file_name}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Size</dt><dd>{formatFileSize(selected.file_size)}</dd></div>
              <div><dt className="text-slate-500">Uploaded</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>
              <div><dt className="text-slate-500">By</dt><dd>{selected.created_by_name || '—'}</dd></div>
              <div><dt className="text-slate-500">Type</dt><dd>{getFileTypeInfo(selected.mime_type, selected.file_name).label}</dd></div>
            </dl>
            {selected.change_summary && (
              <p className="text-sm text-slate-600 dark:text-slate-400 p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                {selected.change_summary}
              </p>
            )}
            <button type="button" onClick={() => handleDownload(selected)} className="btn-primary btn-sm">
              <Download size={14} /> Download this version
            </button>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Select a version to view details.</p>
        )}
      </div>
    </div>
  )
}
