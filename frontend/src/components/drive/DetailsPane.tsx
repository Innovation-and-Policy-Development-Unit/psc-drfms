import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Download, ExternalLink, Lock, Paperclip, ShieldAlert, Sparkles, Star, X } from 'lucide-react'
import { getRecord, getRecordAudit } from '@/api/records'
import { engineLabel } from '@/hooks/useAiStatus'
import { RecordThumb } from '@/components/drive/RecordThumb'
import { ClassificationBadge, DocumentTypeBadge } from '@/lib/recordBadges'
import { RetentionText, formatDate } from '@/lib/driveFormat'
import { formatFileSize, getFileTypeInfo } from '@/utils/fileType'
import { Skeleton } from '@/components/ui/Skeleton'
import { AttachmentList } from '@/components/drive/AttachmentList'
import type { RecordDetail, RecordListItem } from '@/types/api'

interface AuditEntry { id: number; action: string; userName?: string; timestamp: string }

const ACTION_LABELS: Record<string, string> = {
  view: 'Viewed', create: 'Created', update: 'Edited', delete: 'Deleted', download: 'Downloaded',
  upload_version: 'Uploaded a new version', approve: 'Approved', reject: 'Rejected', share: 'Shared',
  share_access: 'Opened via a shared link', sign: 'Digitally signed', legal_hold: 'Legal hold applied',
  legal_hold_lift: 'Legal hold lifted', custody_transfer: 'Custody transferred', export: 'Exported', restore: 'Restored from Recycle bin',
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === '' || children === false) return null
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <dt className="shrink-0 text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 text-end text-[var(--text-primary)]">{children}</dd>
    </div>
  )
}

interface Props {
  /** The record in focus; undefined when nothing is. */
  record?: RecordListItem
  /** More than one row selected: show a count instead. */
  selectedCount: number
  onClose: () => void
  onStar: (record: RecordListItem) => void
  onDownload: (record: RecordListItem) => void
  onCopyLink: (record: RecordListItem) => void
}

/** Side panel with everything about one record, so a folder can be triaged without opening each file. */
export function DetailsPane({ record, selectedCount, onClose, onStar, onDownload, onCopyLink }: Props) {
  const [detail, setDetail] = useState<RecordDetail | null>(null)
  const [activity, setActivity] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const id = record?.id

  useEffect(() => {
    if (!id) { setDetail(null); setActivity([]); return }
    let cancelled = false
    setLoading(true)
    Promise.all([
      getRecord(id).then((r) => r.data as RecordDetail).catch(() => null),
      getRecordAudit(id).then((r) => (r.data.results ?? r.data) as AuditEntry[]).catch(() => []),
    ]).then(([d, a]) => {
      if (cancelled) return
      setDetail(d)
      setActivity(a.slice(0, 5))
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id, record?.updatedAt])

  const version = detail?.latestVersion ?? detail?.latest_version
  const typeInfo = record ? getFileTypeInfo(record.mimeType, record.fileName) : null
  const TypeIcon = typeInfo?.Icon

  return (
    <aside className="drive-details-pane" aria-label="Details">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-default)] px-4 py-3">
        <h2 className="text-sm font-semibold">Details</h2>
        <button type="button" onClick={onClose} className="btn-ghost btn-sm p-1.5" aria-label="Close details"><X size={15} /></button>
      </div>

      {selectedCount > 1 ? (
        <p className="p-4 text-sm text-muted">{selectedCount} records selected. Use the actions above the list to share, download or move them together.</p>
      ) : !record || !typeInfo || !TypeIcon ? (
        <p className="p-4 text-sm text-muted">Select a record to see its details here.</p>
      ) : (
        <div className="space-y-4 p-4">
          <RecordThumb
            recordId={record.id}
            version={record.updatedAt}
            mimeType={record.mimeType}
            alt={`First page of ${record.title}`}
            className={`h-44 w-full overflow-hidden rounded-xl border border-[var(--border-default)] ${typeInfo.light}`}
            fallback={<span className="flex h-full w-full items-center justify-center"><TypeIcon size={44} strokeWidth={1.25} /></span>}
          />

          <div>
            <h3 className="break-words text-base font-semibold leading-snug">{record.title}</h3>
            <p className="font-mono-ref mt-0.5 text-xs text-muted">{record.referenceNumber}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ClassificationBadge level={record.classificationLevel} />
              <DocumentTypeBadge type={record.documentType} />
              {record.isOnLegalHold && <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300"><Lock size={11} /> Legal hold</span>}
              {record.isVital && <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><ShieldAlert size={11} /> Vital</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Link to={`/document/${record.id}`} className="btn-primary btn-sm inline-flex items-center gap-1.5"><ExternalLink size={13} /> Open</Link>
            <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" onClick={() => onDownload(record)}><Download size={13} /> Download</button>
            <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" onClick={() => onCopyLink(record)}><Copy size={13} /> Copy link</button>
            <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" onClick={() => onStar(record)} aria-pressed={!!record.isStarred}>
              <Star size={13} className={record.isStarred ? 'fill-amber-400 text-amber-500' : ''} /> {record.isStarred ? 'Starred' : 'Star'}
            </button>
          </div>

          {loading && !detail ? <Skeleton lines={5} /> : (
            <>
              {version?.aiSummary && (
                <section className="rounded-xl border border-primary-100 bg-primary-50/50 p-3 dark:border-primary-500/20 dark:bg-primary-500/10">
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={12} className="text-primary-500" /> AI summary</h4>
                  <p className="whitespace-pre-line text-sm leading-relaxed">{version.aiSummary}</p>
                  {version.aiEngine && <p className="mt-1.5 text-[10px] text-gray-400">Written by {engineLabel(version.aiEngine)}</p>}
                </section>
              )}

              <dl className="divide-y divide-[var(--border-default)]">
                <Fact label="Ministry">{detail?.originatingMinistry}</Fact>
                <Fact label="Series">{detail?.recordSeriesName}</Fact>
                <Fact label="Document date">{detail?.documentDate ? formatDate(detail.documentDate) : null}</Fact>
                <Fact label="Retention ends">{(detail as { retentionDate?: string } | null)?.retentionDate ? <RetentionText date={(detail as { retentionDate?: string }).retentionDate} /> : null}</Fact>
                <Fact label="Custodian">{detail?.custodianName ?? detail?.custodian_name}</Fact>
                <Fact label="File">{version?.fileName ?? record.fileName}</Fact>
                <Fact label="Size">{record.fileSize ? formatFileSize(record.fileSize) : null}</Fact>
                <Fact label="Versions">{record.versionCount && record.versionCount > 1 ? record.versionCount : null}</Fact>
                <Fact label="Modified">{formatDate(record.updatedAt)}</Fact>
                <Fact label="Sharing">{record.isShared ? 'Shared' : 'Private'}</Fact>
              </dl>

              {!!record.attachmentCount && (
                <section>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold"><Paperclip size={12} /> Attachments ({record.attachmentCount})</h4>
                  <AttachmentList recordId={record.id} variant="pane" />
                </section>
              )}

              {record.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {record.tags.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">{t}</span>)}
                </div>
              )}

              {activity.length > 0 && (
                <section>
                  <h4 className="mb-1.5 text-xs font-semibold">Recent activity</h4>
                  <ul className="space-y-1.5">
                    {activity.map((a) => (
                      <li key={a.id} className="text-xs text-muted">
                        <span className="text-[var(--text-primary)]">{ACTION_LABELS[a.action] ?? a.action.replace(/_/g, ' ')}</span>
                        {a.userName ? ` by ${a.userName}` : ''} · {formatDate(a.timestamp)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  )
}
