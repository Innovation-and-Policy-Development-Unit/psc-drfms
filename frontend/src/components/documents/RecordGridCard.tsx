import { memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Paperclip, Users } from 'lucide-react'
import type { RecordListItem } from '@/types/api'
import { getFileTypeInfo } from '@/utils/fileType'
import { RecordThumb } from '@/components/drive/RecordThumb'
import { ClassificationBadge } from '@/lib/recordBadges'
import clsx from 'clsx'

interface RecordGridCardProps {
  record: RecordListItem
  selected?: boolean
  focused?: boolean
  enableBulk?: boolean
  /** With the details pane open, a click shows details and a double click opens the record. */
  paneOpen?: boolean
  onToggleSelect?: (id: string) => void
  onFocusRecord?: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, record: RecordListItem) => void
}

function RecordGridCardComponent({
  record,
  selected = false,
  focused = false,
  enableBulk = false,
  paneOpen = false,
  onToggleSelect,
  onFocusRecord,
  onContextMenu,
}: RecordGridCardProps) {
  const navigate = useNavigate()
  const ref = record.referenceNumber ?? (record as { reference_number?: string }).reference_number ?? ''
  const typeInfo = getFileTypeInfo(record.mimeType, record.fileName)
  const Icon = typeInfo.Icon

  return (
    <div
      className={clsx('drive-file-tile', selected && 'selected', focused && 'focused')}
      onClick={() => onFocusRecord?.(record.id)}
      onDoubleClick={() => { if (paneOpen) navigate(`/document/${record.id}`) }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(e, record)
      }}
    >
      {enableBulk && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(record.id)}
          className="drive-tile-check rounded-sm border-registry"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${record.title}`}
        />
      )}
      <Link
        to={`/document/${record.id}`}
        onClick={(e) => { if (paneOpen) e.preventDefault() }}
        className="flex w-full flex-col"
      >
        <RecordThumb
          recordId={record.id}
          version={record.updatedAt}
          mimeType={record.mimeType}
          className={clsx('drive-tile-thumb', typeInfo.light)}
          fallback={<span className="flex h-full w-full items-center justify-center"><Icon size={34} strokeWidth={1.4} /></span>}
        />
        <span className="drive-tile-name">{record.title}</span>
        <span className="drive-tile-meta flex items-center gap-1.5">
          <span className="truncate">{ref}</span>
          {record.isShared && <Users size={11} className="shrink-0" aria-label="Shared" />}
          {!!record.attachmentCount && <span className="inline-flex shrink-0 items-center gap-0.5" title={`${record.attachmentCount} attachment${record.attachmentCount > 1 ? 's' : ''}`}><Paperclip size={11} />{record.attachmentCount}</span>}
        </span>
        {record.summaryPreview && <span className="drive-tile-summary">{record.summaryPreview}</span>}
        <span className="mt-1.5 flex"><ClassificationBadge level={record.classificationLevel} /></span>
      </Link>
    </div>
  )
}

export const RecordGridCard = memo(RecordGridCardComponent)
