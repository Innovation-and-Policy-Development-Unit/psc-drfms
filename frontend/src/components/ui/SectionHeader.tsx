import { memo, type ReactNode } from 'react'
import clsx from 'clsx'

interface SectionHeaderProps {
  title: string
  action?: ReactNode
  className?: string
}

function SectionHeaderComponent({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between gap-4 mb-3', className)}>
      <h2 className="label-overline">{title}</h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export const SectionHeader = memo(SectionHeaderComponent)
