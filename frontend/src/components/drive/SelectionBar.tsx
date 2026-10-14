import { memo, type ReactNode } from 'react'
import { Copy, Download, ExternalLink, FolderInput, Share2, Star, Trash2, X } from 'lucide-react'

interface SelectionBarProps {
  count: number
  onClear: () => void
  onOpen?: () => void
  onShare?: () => void
  onCopyLinks?: () => void
  onDownload?: () => void
  onMove?: () => void
  onStar?: () => void
  onDelete?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

function Action({ icon, label, onClick, danger = false }: {
  icon: ReactNode
  label: string
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  danger?: boolean
}) {
  if (!onClick) return null
  return (
    <button type="button" className={`drive-bulk-btn ${danger ? 'text-[var(--status-danger-fg)]' : ''}`} onClick={onClick} title={label}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

/** Takes the place of the column header while rows are selected, like OneDrive's action bar. */
function SelectionBarComponent({ count, onClear, onOpen, onShare, onCopyLinks, onDownload, onMove, onStar, onDelete }: SelectionBarProps) {
  return (
    <div className="drive-selection-bar" role="toolbar" aria-label="Actions for selected records">
      <button type="button" onClick={onClear} className="btn-ghost btn-sm p-1.5" aria-label="Clear selection" title="Clear selection (Esc)">
        <X size={15} />
      </button>
      <span className="me-2 text-sm font-medium tabular-nums">{count} selected</span>
      <div className="flex flex-1 flex-wrap items-center gap-0.5">
        <Action icon={<ExternalLink size={14} />} label="Open" onClick={onOpen} />
        <Action icon={<Share2 size={14} />} label="Share" onClick={onShare} />
        <Action icon={<Copy size={14} />} label="Copy link" onClick={onCopyLinks} />
        <Action icon={<Download size={14} />} label="Download" onClick={onDownload} />
        <Action icon={<FolderInput size={14} />} label="Move" onClick={onMove} />
        <Action icon={<Star size={14} />} label="Star" onClick={onStar} />
        <Action icon={<Trash2 size={14} />} label="Delete" onClick={onDelete} danger />
      </div>
    </div>
  )
}

export const SelectionBar = memo(SelectionBarComponent)
