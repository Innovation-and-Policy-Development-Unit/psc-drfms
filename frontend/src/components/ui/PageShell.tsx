import { memo, useEffect, type ReactNode } from 'react'
import { DriveToolbar } from '@/components/drive/DriveToolbar'
import { useDriveUI } from '@/context/DriveUIContext'
import type { BreadcrumbItem } from '@/types/api'

interface PageShellProps {
  title: string
  subtitle?: string
  action?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  children: ReactNode
}

function PageShellComponent({
  title,
  subtitle,
  action,
  breadcrumbs,
  children,
}: PageShellProps) {
  const { setStatusMessage } = useDriveUI()
  const crumbs = breadcrumbs ?? [{ label: title }]

  useEffect(() => {
    setStatusMessage(title)
  }, [title, setStatusMessage])

  return (
    <div className="flex flex-col min-h-full">
      <DriveToolbar
        breadcrumbs={crumbs}
        actions={action}
      />
      {subtitle && (
        <p className="px-4 py-2 text-sm text-muted border-b border-registry bg-[var(--surface-raised)]">
          {subtitle}
        </p>
      )}
      <div className="drive-page-body">{children}</div>
    </div>
  )
}

export const PageShell = memo(PageShellComponent)
