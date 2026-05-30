import { memo } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

function EmptyStateComponent({ title, description, action }: EmptyStateProps) {
  return (
    <div className="py-16 px-6 text-center border border-dashed border-registry rounded-sm bg-raised">
      <p className="font-serif text-base font-medium text-[var(--text-primary)]">{title}</p>
      {description && <p className="text-sm text-muted mt-2 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export const EmptyState = memo(EmptyStateComponent)
