import { memo } from 'react'
import { ArrowDownUp } from 'lucide-react'
import clsx from 'clsx'
import { useDriveUI } from '@/context/DriveUIContext'
import { useTransfers } from '@/context/TransferContext'

interface DriveStatusBarProps {
  itemCount?: number
  label?: string
}

function DriveStatusBarComponent({ itemCount, label = 'records' }: DriveStatusBarProps) {
  const { statusMessage, viewMode } = useDriveUI()
  const { activeCount, togglePanel, panelOpen, uploadProgress, downloadProgress } = useTransfers()

  const transferLabel = activeCount > 0
    ? `Transfers (${activeCount}) · ↑${uploadProgress}% ↓${downloadProgress}%`
    : 'Transfers'

  return (
    <footer className="drive-statusbar">
      <span>
        {itemCount != null ? `${itemCount} ${label}` : statusMessage || 'Ready'}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={clsx('drive-statusbar-transfers', (panelOpen || activeCount > 0) && 'active')}
          onClick={togglePanel}
        >
          {activeCount > 0 && <span className="status-mini-ring" aria-hidden />}
          <ArrowDownUp size={14} />
          {transferLabel}
        </button>
        <span className="capitalize">{viewMode} view</span>
      </div>
    </footer>
  )
}

export const DriveStatusBar = memo(DriveStatusBarComponent)
