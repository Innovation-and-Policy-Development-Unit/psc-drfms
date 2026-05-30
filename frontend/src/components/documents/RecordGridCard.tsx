import { memo } from 'react'
import { Link } from 'react-router-dom'
import type { RecordListItem } from '@/types/api'
import { getFileTypeInfo } from '@/utils/fileType'
import clsx from 'clsx'

interface RecordGridCardProps {
  record: RecordListItem
  selected?: boolean
  enableBulk?: boolean
  onToggleSelect?: (id: string) => void
  onContextMenu?: (e: React.MouseEvent, record: RecordListItem) => void
}

function RecordGridCardComponent({
  record,
  selected = false,
  enableBulk = false,
  onToggleSelect,
  onContextMenu,
}: RecordGridCardProps) {
  const ref = record.referenceNumber ?? (record as { reference_number?: string }).reference_number ?? ''
  const typeInfo = getFileTypeInfo(record.mimeType, record.fileName)
  const Icon = typeInfo.Icon

  return (
    <div
      className={clsx('drive-file-tile', selected && 'selected')}
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
        />
      )}
      <Link to={`/document/${record.id}`} className="flex flex-col items-center w-full">
        <div className={clsx('drive-tile-icon', typeInfo.light)}>
          <Icon size={28} strokeWidth={1.5} />
        </div>
        <span className="drive-tile-name">{record.title}</span>
        <span className="drive-tile-meta">{ref}</span>
      </Link>
    </div>
  )
}

export const RecordGridCard = memo(RecordGridCardComponent)
