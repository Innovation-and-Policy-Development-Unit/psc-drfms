import { memo, type ReactNode } from 'react'

interface PageShellProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}

function PageShellComponent({ title, subtitle, action, children }: PageShellProps) {
  return (
    <div className="space-y-6 animate-registry-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-registry pb-4">
        <div>
          <h1 className="page-title">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted mt-1 max-w-2xl">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
    </div>
  )
}

export const PageShell = memo(PageShellComponent)
