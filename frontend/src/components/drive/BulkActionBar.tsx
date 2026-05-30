import { memo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  onOpen?: () => void
  onStar?: () => void
  onCopyLinks?: () => void
}

function BulkActionBarComponent({ count, onClear, onOpen, onStar, onCopyLinks }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div className="drive-bulk-bar">
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      <div className="flex items-center gap-1 flex-wrap">
        {onOpen && (
          <button type="button" className="drive-bulk-btn" onClick={onOpen}>
            <ExternalLink size={14} />
            Open
          </button>
        )}
        {onStar && (
          <button type="button" className="drive-bulk-btn" onClick={onStar}>
            <Star size={14} />
            Add star
          </button>
        )}
        {onCopyLinks && (
          <button type="button" className="drive-bulk-btn" onClick={onCopyLinks}>
            Copy links
          </button>
        )}
        <Button size="sm" variant="ghost" onClick={onClear} className="ms-1">
          <X size={14} />
          Clear
        </Button>
      </div>
    </div>
  )
}

export const BulkActionBar = memo(BulkActionBarComponent)

export function BulkActionBarLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="drive-bulk-btn">{children}</Link>
}
