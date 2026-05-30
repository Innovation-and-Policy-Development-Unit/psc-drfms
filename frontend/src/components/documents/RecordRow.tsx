import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { RecordListItem } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { ClassificationBadge, DocumentTypeBadge } from '@/lib/recordBadges'
import { formatFileSize, getFileTypeInfo } from '@/utils/fileType'

interface RecordRowProps {
  record: RecordListItem
  variant?: 'table' | 'list'
  enableBulk?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  showSnippet?: boolean
}

function RecordRowComponent({
  record,
  variant = 'table',
  enableBulk = false,
  selected = false,
  onToggleSelect,
  showSnippet = false,
}: RecordRowProps) {
  const ref = record.referenceNumber ?? (record as { reference_number?: string }).reference_number ?? ''
  const docType = record.documentType ?? (record as { document_type?: string }).document_type
  const classification = record.classificationLevel ?? (record as { classification_level?: string }).classification_level
  const updated = record.updatedAt ?? (record as { updated_at?: string }).updated_at
  const snippet = record.matchSnippet ?? (record as { match_snippet?: string }).match_snippet
  const typeInfo = getFileTypeInfo(record.mimeType, record.fileName)

  if (variant === 'list') {
    return (
      <Link to={`/document/${record.id}`} className="panel-interactive block p-4">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono-ref text-xs text-muted">{ref}</span>
          {docType && <DocumentTypeBadge type={docType} />}
          {classification && <ClassificationBadge level={classification} />}
          {record.isOnLegalHold && <span className="text-[10px] text-[var(--status-danger-fg)]">HOLD</span>}
          {record.isVital && <span className="text-[10px] text-[var(--status-warning-fg)]">VITAL</span>}
        </div>
        <h3 className="font-medium truncate">{record.title}</h3>
        {showSnippet && snippet && (
          <p className="text-sm text-muted mt-1 line-clamp-2">{snippet}</p>
        )}
        {record.originatingMinistry && (
          <p className="text-sm text-muted mt-0.5">{record.originatingMinistry}</p>
        )}
        {updated && (
          <p className="text-xs text-muted mt-2">
            Modified {new Date(updated).toLocaleDateString()}
          </p>
        )}
      </Link>
    )
  }

  return (
    <tr>
      {enableBulk && (
        <td>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(record.id)}
            className="rounded-sm border-registry"
            aria-label={`Select ${record.title}`}
          />
        </td>
      )}
      <td>
        <Link
          to={`/document/${record.id}`}
          className="font-mono-ref text-xs hover:underline text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))]"
        >
          {ref}
        </Link>
        {record.isOnLegalHold && <span className="ms-2 text-[10px] text-[var(--status-danger-fg)]">HOLD</span>}
        {record.isVital && <span className="ms-1 text-[10px] text-[var(--status-warning-fg)]">VITAL</span>}
      </td>
      <td className="max-w-md">
        <Link to={`/document/${record.id}`} className="text-sm text-[var(--text-primary)] hover:underline truncate block">
          {record.title}
        </Link>
      </td>
      <td className="text-xs capitalize">{typeInfo.label}</td>
      <td><Badge tone="info">{classification}</Badge></td>
      <td className="text-xs text-muted whitespace-nowrap">
        {updated ? new Date(updated).toLocaleDateString() : '—'}
      </td>
      <td className="text-xs text-muted text-end font-mono-ref">
        {record.fileSize ? formatFileSize(record.fileSize) : '—'}
      </td>
    </tr>
  )
}

export const RecordRow = memo(RecordRowComponent)
