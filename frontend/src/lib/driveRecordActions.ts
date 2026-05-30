import type { RecordListItem } from '@/types/api'

export function recordDetailPath(id: string) {
  return `/document/${id}`
}

export function recordAbsoluteUrl(id: string) {
  return `${window.location.origin}${recordDetailPath(id)}`
}

export async function copyRecordLink(id: string) {
  await navigator.clipboard.writeText(recordAbsoluteUrl(id))
}

export function buildRecordContextMenuItems(
  record: RecordListItem,
  handlers: {
    onOpen: () => void
    onSelect: () => void
    onStar: () => void
    onDownload: () => void
    onCopyLink: () => void
    onClearSelection: () => void
    hasSelection: boolean
  },
) {
  return [
    { id: 'open', label: 'Open', onClick: handlers.onOpen },
    { id: 'select', label: 'Select', onClick: handlers.onSelect },
    { id: 'star', label: record.isStarred ? 'Remove star' : 'Add star', onClick: handlers.onStar },
    { id: 'download', label: 'Download', onClick: handlers.onDownload },
    { id: 'link', label: 'Copy link', onClick: handlers.onCopyLink },
    ...(handlers.hasSelection
      ? [{ id: 'clear', label: 'Clear selection', onClick: handlers.onClearSelection }]
      : []),
  ]
}
