import { memo } from 'react'
import clsx from 'clsx'
import { useDriveListColumns } from '@/context/ResizableColumnsContext'

interface ResizableDriveListHeaderProps {
  enableBulk?: boolean
  allSelected?: boolean
  someSelected?: boolean
  onToggleAll?: () => void
}

function ResizableDriveListHeaderComponent({
  enableBulk = false,
  allSelected = false,
  someSelected = false,
  onToggleAll,
}: ResizableDriveListHeaderProps) {
  const { gridTemplate, startResize } = useDriveListColumns()

  return (
    <div
      className={clsx('drive-files-header', enableBulk && 'bulk')}
      style={{ gridTemplateColumns: gridTemplate(enableBulk) }}
    >
      {enableBulk && (
        <span className="flex items-center">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
            onChange={onToggleAll}
            aria-label="Select all"
            className="rounded-sm border-registry"
          />
        </span>
      )}
      <span />
      <span className="drive-col-header">
        Name
      </span>
      <span className="drive-col-header relative">
        Type
        <span
          className="drive-col-resize"
          onMouseDown={(e) => startResize('type', e.clientX)}
          role="separator"
          aria-orientation="vertical"
        />
      </span>
      <span className="drive-col-header relative">
        Modified
        <span
          className="drive-col-resize"
          onMouseDown={(e) => startResize('modified', e.clientX)}
          role="separator"
          aria-orientation="vertical"
        />
      </span>
      <span className="drive-col-header relative text-end">
        Size
        <span
          className="drive-col-resize"
          onMouseDown={(e) => startResize('size', e.clientX)}
          role="separator"
          aria-orientation="vertical"
        />
      </span>
    </div>
  )
}

export const ResizableDriveListHeader = memo(ResizableDriveListHeaderComponent)
