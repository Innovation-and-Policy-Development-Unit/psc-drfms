import { memo } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import type { RecordListItem } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { ClassificationBadge, DocumentTypeBadge } from '@/lib/recordBadges'
import { useDriveListColumns } from '@/context/ResizableColumnsContext'
import { formatFileSize, getFileTypeInfo } from '@/utils/fileType'

interface RecordRowProps {
  record: RecordListItem
  variant?: 'table' | 'list' | 'drive-list'
  enableBulk?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, record: RecordListItem) => void
  showSnippet?: boolean
}

function DriveListRow(props: RecordRowProps) {
  const { record, enableBulk, selected, onToggleSelect, onContextMenu } = props
  const { gridTemplate } = useDriveListColumns()
  const ref = record.referenceNumber ?? (record as { reference_number?: string }).reference_number ?? ''
  const updated = record.updatedAt ?? (record as { updated_at?: string }).updated_at
  const typeInfo = getFileTypeInfo(record.mimeType, record.fileName)
  const Icon = typeInfo.Icon

  return (
    <div
      className={clsx('drive-file-row', enableBulk && 'bulk', selected && 'selected')}
      style={{ gridTemplateColumns: gridTemplate(!!enableBulk) }}
      onContextMenu={(e) => onContextMenu?.(e, record)}
    >
      {enableBulk && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.(record.id)}
          className="rounded-sm border-registry"
          aria-label={`Select ${record.title}`}
        />
      )}
      <Link to={`/document/${record.id}`} className={clsx('drive-file-icon', typeInfo.light)}>
        <Icon size={20} strokeWidth={1.75} />
      </Link>
      <Link to={`/document/${record.id}`} className="drive-file-name min-w-0">
        <p className="drive-file-name-title">{record.title}</p>
        <p className="drive-file-name-meta">
          {ref}
          {record.isOnLegalHold && ' · HOLD'}
          {record.isVital && ' · VITAL'}
        </p>
      </Link>
      <span className="text-xs capitalize truncate">{typeInfo.label}</span>
      <span className="text-xs text-muted whitespace-nowrap">
        {updated ? new Date(updated).toLocaleDateString() : '—'}
      </span>
      <span className="text-xs text-muted text-end font-mono-ref whitespace-nowrap">
        {record.fileSize ? formatFileSize(record.fileSize) : '—'}
      </span>
    </div>
  )
}

function RecordRowComponent(props: RecordRowProps) {
  const {
    record,
    variant = 'table',
    enableBulk = false,
    selected = false,
    onToggleSelect,
    onContextMenu,
    showSnippet = false,
  } = props

  if (variant === 'drive-list') {
    return <DriveListRow {...props} />
  }

  const ref = record.referenceNumber ?? (record as { reference_number?: string }).reference_number ?? ''
  const docType = record.documentType ?? (record as { document_type?: string }).document_type
  const classification = record.classificationLevel ?? (record as { classification_level?: string }).classification_level
  const updated = record.updatedAt ?? (record as { updated_at?: string }).updated_at
  const snippet = record.matchSnippet ?? (record as { match_snippet?: string }).match_snippet
  const typeInfo = getFileTypeInfo(record.mimeType, record.fileName)

  if (variant === 'list') {
    return (
      <Link
        to={`/document/${record.id}`}
        className="panel-interactive block p-4"
        onContextMenu={(e) => onContextMenu?.(e, record)}
      >
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono-ref text-xs text-muted">{ref}</span>
          {docType && <DocumentTypeBadge type={docType} />}
          {classification && <ClassificationBadge level={classification} />}
        </div>
        <h3 className="font-medium truncate">{record.title}</h3>
        {showSnippet && snippet && <p className="text-sm text-muted mt-1 line-clamp-2">{snippet}</p>}
      </Link>
    )
  }

  return (
    <tr onContextMenu={(e) => onContextMenu?.(e, record)}>
      {enableBulk && (
        <td>
          <input type="checkbox" checked={selected} onChange={() => onToggleSelect?.(record.id)} className="rounded-sm border-registry" />
        </td>
      )}
      <td>
        <Link to={`/document/${record.id}`} className="font-mono-ref text-xs hover:underline text-[var(--brand-mega)]">{ref}</Link>
      </td>
      <td className="max-w-md">
        <Link to={`/document/${record.id}`} className="text-sm hover:underline truncate block">{record.title}</Link>
      </td>
      <td className="text-xs capitalize">{typeInfo.label}</td>
      <td><Badge tone="info">{classification}</Badge></td>
      <td className="text-xs text-muted whitespace-nowrap">{updated ? new Date(updated).toLocaleDateString() : '—'}</td>
      <td className="text-xs text-muted text-end font-mono-ref">{record.fileSize ? formatFileSize(record.fileSize) : '—'}</td>
    </tr>
  )
}

export const RecordRow = memo(RecordRowComponent)
