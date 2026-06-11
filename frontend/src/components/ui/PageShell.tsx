import { memo, useEffect, type ReactNode } from 'react'
import { DriveToolbar } from '@/components/drive/DriveToolbar'
import { useDriveUI } from '@/context/DriveUIContext'
import type { BreadcrumbItem } from '@/types/api'

interface PageShellProps {
  title: string
  subtitle?: string
  action?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  showViewToggle?: boolean
  children: ReactNode
}

function PageShellComponent({
  title,
  subtitle,
  action,
  breadcrumbs,
  showViewToggle = false,
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
        showViewToggle={showViewToggle}
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
