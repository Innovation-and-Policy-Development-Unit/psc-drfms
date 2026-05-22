import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { recordsApi, onlyofficeApi } from '../../api'
import { getFileTypeInfo, formatFileSize, getOfficeOpenUrl } from '../../utils/fileType'
import OnlyOfficeEditor from '../../components/record/OnlyOfficeEditor'
import CommentsPanel from '../../components/record/CommentsPanel'
import VersionsPanel from '../../components/record/VersionsPanel'
import SharePanel from '../../components/record/SharePanel'
import ShareDialog from '../../components/record/ShareDialog'
import PermissionsPanel from '../../components/record/PermissionsPanel'
import GovernancePanel from '../../components/record/GovernancePanel'
import ActivityPanel from '../../components/record/ActivityPanel'
import clsx from 'clsx'
import {
  ArrowLeft, Download, Lock, Star, Loader2,
  MessageSquare, History, Share2, Shield, FileStack, Eye, ExternalLink,
} from 'lucide-react'

const TABS = [
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'versions', label: 'Versions', icon: FileStack },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'share', label: 'Share', icon: Share2 },
  { id: 'access', label: 'Access', icon: Shield },
  { id: 'governance', label: 'Governance', icon: Lock },
  { id: 'activity', label: 'Activity', icon: History },
]

export default function RecordDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [ooConfig, setOoConfig] = useState(null)
  const [ooApiUrl, setOoApiUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('preview')
  const [shareOpen, setShareOpen] = useState(false)
  const [starring, setStarring] = useState(false)

  const loadRecord = useCallback(() => {
    recordsApi.getRecord(id)
      .then(({ data }) => setRecord(data))
      .catch(() => setError('Document not found or you do not have access.'))
  }, [id])

  useEffect(() => {
    setLoading(true)
    setError('')
    recordsApi.getRecord(id)
      .then(({ data }) => setRecord(data))
      .catch(() => setError('Document not found or you do not have access.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!record?.latest_version?.id || tab !== 'preview') return
    const version = record.latest_version
    const { previewable, officeType } = getFileTypeInfo(version.mime_type, version.file_name)

    setPreviewUrl(null)
    setOoConfig(null)
    setOoApiUrl(null)

    if (officeType) {
      setPreviewLoading(true)
      onlyofficeApi.getConfig(id, version.id)
        .then(({ data }) => {
          setOoConfig(data)
          setOoApiUrl(data.editor_api_url)
        })
        .catch(() => { setOoConfig(null); setOoApiUrl(null) })
        .finally(() => setPreviewLoading(false))
      return
    }

    if (!previewable) return

    setPreviewLoading(true)
    let objectUrl
    recordsApi.downloadVersion(id, version.id, true)
      .then(res => {
        objectUrl = URL.createObjectURL(res.data)
        setPreviewUrl(objectUrl)
      })
      .catch(() => setPreviewUrl(null))
      .finally(() => setPreviewLoading(false))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [record, id, tab])

  const handleDownload = async () => {
    const version = record?.latest_version
    if (!version) return
    const { data } = await recordsApi.downloadVersion(id, version.id, false)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = version.file_name
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleStar = async () => {
    if (!record || starring) return
    setStarring(true)
    try {
      if (record.is_starred) {
        await recordsApi.unstarRecord(id)
        setRecord(r => ({ ...r, is_starred: false }))
      } else {
        await recordsApi.starRecord(id)
        setRecord(r => ({ ...r, is_starred: true }))
      }
    } finally {
      setStarring(false)
    }
  }

  if (loading && !record) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-600">{error || 'Document not found'}</p>
        <button type="button" onClick={() => navigate('/browse')} className="btn-primary mt-4">Back to files</button>
      </div>
    )
  }

  const version = record.latest_version
  const { Icon, color, previewable, officeType, label } = getFileTypeInfo(version?.mime_type, version?.file_name)

  return (
    <div className="space-y-4">
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        recordId={id}
        recordTitle={record.title}
      />

      {/* Page header card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0">
            <ArrowLeft size={18} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0', color)}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{record.title}</h1>
            <p className="text-xs text-slate-500 font-mono">{record.reference_number}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {record.is_on_legal_hold && <Lock size={16} className="text-red-500" title="Legal hold" />}
            <button
              type="button"
              onClick={toggleStar}
              disabled={starring}
              className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
              title={record.is_starred ? 'Unstar' : 'Star'}
            >
              <Star size={18} className={record.is_starred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'} />
            </button>
            <button type="button" onClick={() => setShareOpen(true)} className="btn-outline btn-sm">
              <Share2 size={14} /> Share
            </button>
            {version && (
              <button type="button" onClick={handleDownload} className="btn-primary btn-sm">
                <Download size={14} /> Download
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 overflow-x-auto scrollbar-hide border-t border-slate-100 dark:border-slate-700">
          {TABS.map(({ id: tid, label, icon: TabIcon }) => (
            <button
              key={tid}
              type="button"
              onClick={() => setTab(tid)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                tab === tid
                  ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              <TabIcon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'preview' && (
        <div className="flex gap-4">
          <div className={clsx(
            'flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden min-h-[520px]',
            (ooConfig && ooApiUrl) ? '' : 'flex items-center justify-center'
          )}>
            {previewLoading ? (
              <Loader2 size={28} className="animate-spin text-slate-400" />
            ) : ooConfig && ooApiUrl ? (
              <OnlyOfficeEditor config={ooConfig} apiUrl={ooApiUrl} />
            ) : previewUrl && previewable ? (
              version.mime_type?.includes('pdf') ? (
                <iframe title="Preview" src={previewUrl} className="w-full h-full min-h-[520px] border-0" />
              ) : (
                <img src={previewUrl} alt={record.title} className="max-w-full max-h-[520px] object-contain p-4" />
              )
            ) : officeType ? (
              <OfficeFallback label={label} color={color} Icon={Icon} version={version} officePreview={null} onDownload={handleDownload} />
            ) : (
              <div className="text-center p-8">
                <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center text-white mx-auto mb-4', color)}>
                  <Icon size={40} />
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Preview not available for this file type</p>
                {version && (
                  <button type="button" onClick={handleDownload} className="btn-primary mt-4">
                    <Download size={16} /> Download
                  </button>
                )}
              </div>
            )}
          </div>
          <aside className="w-64 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm space-y-3 hidden lg:block self-start">
            <DetailField label="File" value={version?.file_name} />
            <DetailField label="Size" value={formatFileSize(version?.file_size)} />
            <DetailField label="Modified" value={record.updated_at ? new Date(record.updated_at).toLocaleString() : '—'} />
            <DetailField label="Custodian" value={record.custodian_name} />
            {record.description && <DetailField label="Description" value={record.description} />}
          </aside>
        </div>
      )}
      {tab === 'versions'   && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"><VersionsPanel recordId={id} onVersionChange={loadRecord} /></div>}
      {tab === 'comments'   && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"><CommentsPanel recordId={id} /></div>}
      {tab === 'share'      && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"><SharePanel recordId={id} recordTitle={record.title} /></div>}
      {tab === 'access'     && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"><PermissionsPanel recordId={id} /></div>}
      {tab === 'governance' && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"><GovernancePanel record={record} /></div>}
      {tab === 'activity'   && <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"><ActivityPanel recordId={id} /></div>}
    </div>
  )
}

function OfficeFallback({ label, color, Icon, version, officePreview, onDownload }) {
  const openInApp = () => {
    const base = getOfficeOpenUrl(
      getFileTypeInfo(version?.mime_type, version?.file_name).officeType,
      version?.file_name
    )
    if (officePreview?.download_url) {
      window.location.href = base + encodeURIComponent(officePreview.download_url)
    } else {
      onDownload()
    }
  }

  return (
    <div className="text-center p-8 max-w-md">
      <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center text-white mx-auto mb-4', color)}>
        <Icon size={40} />
      </div>
      <p className="text-lg font-medium text-slate-800 dark:text-slate-200">{label} document</p>
      <p className="text-sm text-slate-500 mt-2">
        The collaborative editor is unavailable. Open the file in your local Office application or download it.
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-6">
        <button type="button" onClick={openInApp} className="btn-primary">
          <ExternalLink size={16} /> Open in {label}
        </button>
        <button type="button" onClick={onDownload} className="btn-outline">
          <Download size={16} /> Download
        </button>
        {officePreview?.office_embed_url && (
          <a
            href={officePreview.office_embed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            Try Office Online
          </a>
        )}
      </div>
    </div>
  )
}

function DetailField({ label, value }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800 dark:text-slate-200 mt-0.5">{value}</dd>
    </div>
  )
}
