import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'

export interface ConfirmAnchor {
  x: number
  y: number
}

interface ConfirmPopoverProps {
  anchor: ConfirmAnchor | null
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

const WIDTH = 288
const EST_HEIGHT = 120

/** Returns viewport coordinates just below the clicked control, for use as a popover anchor. */
export function anchorFromEvent(e: React.MouseEvent<HTMLElement>): ConfirmAnchor {
  const rect = e.currentTarget.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.bottom + 6 }
}

export function ConfirmPopover({
  anchor,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!anchor) return
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onCancel])

  if (!anchor) return null

  const left = Math.min(Math.max(8, anchor.x - WIDTH / 2), window.innerWidth - WIDTH - 8)
  const openAbove = anchor.y + EST_HEIGHT > window.innerHeight
  const top = openAbove ? Math.max(8, anchor.y - 12) : anchor.y

  return createPortal(
    <div
      ref={ref}
      role="alertdialog"
      aria-label="Confirm action"
      className="panel fixed z-[200] p-3 shadow-lg animate-registry-in"
      style={{ left, top, width: WIDTH, transform: openAbove ? 'translateY(-100%)' : undefined }}
    >
      <p className="text-sm text-secondary">{message}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
        <Button size="sm" variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>,
    document.body,
  )
}
