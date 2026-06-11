import { memo, type ReactNode } from 'react'
import clsx from 'clsx'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

const tones: Record<Tone, string> = {
  neutral: 'bg-[var(--surface-sunken)] text-secondary',
  success: 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)]',
  warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]',
  danger: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]',
  info: 'bg-[var(--surface-sunken)] text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))]',
}

function BadgeComponent({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span className={clsx('status-pill', tones[tone], className)}>
      {children}
    </span>
  )
}

export const Badge = memo(BadgeComponent)
