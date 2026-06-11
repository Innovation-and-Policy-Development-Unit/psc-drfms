import { memo, type ReactNode } from 'react'
import clsx from 'clsx'

interface PanelProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

function PanelComponent({ children, className, padding = true }: PanelProps) {
  return (
    <div className={clsx('panel', padding && 'p-4', className)}>
      {children}
    </div>
  )
}

export const Panel = memo(PanelComponent)
