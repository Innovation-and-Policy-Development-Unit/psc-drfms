import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { recordsApi, onlyofficeApi } from '@/api'
import type { RecordDetail as RecordDetailType } from '@/types/api'
import { getFileTypeInfo, formatFileSize, getOfficeOpenUrl } from '@/utils/fileType'
import OnlyOfficeEditor from '@/components/record/OnlyOfficeEditor'
import CommentsPanel from '@/components/record/CommentsPanel'
import VersionsPanel from '@/components/record/VersionsPanel'
import SharePanel from '@/components/record/SharePanel'
import ShareDialog from '@/components/record/ShareDialog'
import PermissionsPanel from '@/components/record/PermissionsPanel'
import GovernancePanel from '@/components/record/GovernancePanel'
import ActivityPanel from '@/components/record/ActivityPanel'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

const TABS = [
  { id: 'preview', label: 'Preview' },
  { id: 'versions', label: 'Versions' },
  { id: 'comments', label: 'Comments' },
  { id: 'share', label: 'Share' },
  { id: 'access', label: 'Access' },
  { id: 'governance', label: 'Governance' },
  { id: 'activity', label: 'Activity' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function RecordDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [record, setRecord] = useState<RecordDetailType | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [ooConfig, setOoConfig] = useState<Record<string, unknown> | null>(null)
  const [ooApiUrl, setOoApiUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabId>('preview')
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
    const version = record?.latestVersion
    if (!version?.id || tab !== 'preview') return
    const { previewable, officeType } = getFileTypeInfo(version.mimeType ?? version.mime_type, version.fileName ?? version.file_name)

    setPreviewUrl(null)
    setOoConfig(null)
    setOoApiUrl(null)

    if (officeType) {
      setPreviewLoading(true)
      onlyofficeApi.getConfig(id, String(version.id))
        .then(({ data }) => {
          setOoConfig(data)
          setOoApiUrl(data.editorApiUrl ?? data.editor_api_url)
        })
        .catch(() => { setOoConfig(null); setOoApiUrl(null) })
        .finally(() => setPreviewLoading(false))
      return
    }

    if (!previewable) return

    setPreviewLoading(true)
    let objectUrl: string | undefined
    recordsApi.downloadVersion(id, String(version.id), true)
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data)
        setPreviewUrl(objectUrl)
      })
      .catch(() => setPreviewUrl(null))
      .finally(() => setPreviewLoading(false))

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [record, id, tab])

  const handleDownload = async () => {
    const version = record?.latestVersion
    if (!version) return
    const { data } = await recordsApi.downloadVersion(id, String(version.id), false)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = version.fileName ?? version.file_name ?? 'download'
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleStar = async () => {
    if (!record || starring) return
    setStarring(true)
    try {
      if (record.isStarred ?? record.is_starred) {
        await recordsApi.unstarRecord(id)
        setRecord((r) => r && { ...r, isStarred: false, is_starred: false })
      } else {
        await recordsApi.starRecord(id)
        setRecord((r) => r && { ...r, isStarred: true, is_starred: true })
      }
    } finally {
      setStarring(false)
    }
  }

  if (loading && !record) {
    return (
      <div className="space-y-4 animate-registry-in">
        <Skeleton className="h-28" />
        <Skeleton className="h-[520px]" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <Panel className="py-12 text-center">
        <p className="text-secondary">{error || 'Document not found'}</p>
        <Button className="mt-4" onClick={() => navigate('/browse')}>Back to files</Button>
      </Panel>
    )
  }

  const version = record.latestVersion ?? record.latest_version
  const fileName = version?.fileName ?? version?.file_name
  const mimeType = version?.mimeType ?? version?.mime_type
  const { previewable, officeType, label } = getFileTypeInfo(mimeType, fileName)
  const refNum = record.referenceNumber ?? record.reference_number
  const onHold = record.isOnLegalHold ?? record.is_on_legal_hold
  const starred = record.isStarred ?? record.is_starred

  return (
    <div className="space-y-4 animate-registry-in">
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} recordId={id} recordTitle={record.title} />

      <Panel className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-start gap-3 px-4 pt-4 pb-3 border-b border-registry">
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost btn-sm">
            Back
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title truncate">{record.title}</h1>
              {onHold && <Badge tone="danger">Legal hold</Badge>}
            </div>
            <p className="ref-mono mt-0.5">{refNum}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={toggleStar} disabled={starring}>
              {starred ? 'Unstar' : 'Star'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>Share</Button>
            {version && (
              <Button size="sm" onClick={handleDownload}>Download</Button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row min-h-[560px]">
          <nav className="section-nav border-b lg:border-b-0 lg:border-e border-registry py-2 lg:py-3 px-1">
            {TABS.map(({ id: tid, label: tabLabel }) => (
              <button
                key={tid}
                type="button"
                onClick={() => setTab(tid)}
                className={clsx('section-nav-item', tab === tid && 'active')}
              >
                {tabLabel}
              </button>
            ))}
          </nav>

          <div className="flex-1 min-w-0 p-4">
            {tab === 'preview' && (
              <div className="flex flex-col xl:flex-row gap-4">
                <div
                  className={clsx(
                    'flex-1 panel overflow-hidden min-h-[480px] p-0',
                    !(ooConfig && ooApiUrl) && !previewUrl && 'flex items-center justify-center',
                  )}
                >
                  {previewLoading ? (
                    <Skeleton className="w-full h-[480px]" />
                  ) : ooConfig && ooApiUrl ? (
                    <OnlyOfficeEditor config={ooConfig} apiUrl={ooApiUrl} />
                  ) : previewUrl && previewable ? (
                    mimeType?.includes('pdf') ? (
                      <iframe title="Preview" src={previewUrl} className="w-full h-full min-h-[480px] border-0" />
                    ) : (
                      <img src={previewUrl} alt={record.title} className="max-w-full max-h-[480px] object-contain p-4 mx-auto" />
                    )
                  ) : officeType ? (
                    <OfficeFallback label={label} version={version} onDownload={handleDownload} />
                  ) : (
                    <div className="text-center p-8">
                      <p className="body-text">Preview not available for this file type.</p>
                      {version && (
                        <Button className="mt-4" onClick={handleDownload}>Download file</Button>
                      )}
                    </div>
                  )}
                </div>
                <aside className="xl:w-56 shrink-0 text-sm space-y-3">
                  <DetailField label="File" value={fileName} />
                  <DetailField label="Size" value={formatFileSize(version?.fileSize ?? version?.file_size)} />
                  <DetailField
                    label="Modified"
                    value={record.updatedAt ?? record.updated_at
                      ? new Date(record.updatedAt ?? record.updated_at!).toLocaleString()
                      : undefined}
                  />
                  <DetailField label="Custodian" value={record.custodianName ?? record.custodian_name} />
                  {record.description && <DetailField label="Description" value={record.description} />}
                </aside>
              </div>
            )}

            {tab === 'versions' && <VersionsPanel recordId={id} onVersionChange={loadRecord} />}
            {tab === 'comments' && <CommentsPanel recordId={id} />}
            {tab === 'share' && <SharePanel recordId={id} recordTitle={record.title} />}
            {tab === 'access' && <PermissionsPanel recordId={id} />}
            {tab === 'governance' && <GovernancePanel record={record} />}
            {tab === 'activity' && <ActivityPanel recordId={id} />}
          </div>
        </div>
      </Panel>
    </div>
  )
}

function OfficeFallback({
  label,
  version,
  onDownload,
}: {
  label: string
  version: RecordDetailType['latestVersion']
  onDownload: () => void
}) {
  const openInApp = () => {
    const fileName = version?.fileName ?? version?.file_name
    const mime = version?.mimeType ?? version?.mime_type
    const base = getOfficeOpenUrl(getFileTypeInfo(mime, fileName).officeType, fileName)
    if (base) window.location.href = base
    else onDownload()
  }

  return (
    <div className="text-center p-8 max-w-md">
      <p className="font-medium">{label} document</p>
      <p className="text-sm text-muted mt-2">
        The collaborative editor is unavailable. Open locally or download the file.
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-6">
        <Button onClick={openInApp}>Open in {label}</Button>
        <Button variant="secondary" onClick={onDownload}>Download</Button>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <dt className="label-overline">{label}</dt>
      <dd className="text-[var(--text-primary)] mt-1">{value}</dd>
    </div>
  )
}
