import { useState, Fragment } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import DriveSidebar from '../drive/DriveSidebar'
import DriveTopBar from '../drive/DriveTopBar'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'

// Each entry: [pattern, crumbs[]]
// crumbs item: { label, to? }  — no `to` means it's the current/last segment (not linked)
// Ordered most-specific first so the first match wins.
import type { BreadcrumbItem } from '@/types/api'

const CRUMB_MAP: Array<[string, BreadcrumbItem[]]> = [
  ['/submissions/assigned', [{ label: 'Submissions', to: '/submissions' }, { label: 'My assigned' }]],
  ['/submissions/overdue',  [{ label: 'Submissions', to: '/submissions' }, { label: 'Overdue / SLA' }]],
  ['/submissions/new',      [{ label: 'Submissions', to: '/submissions' }, { label: 'New submission' }]],
  ['/submissions',          [{ label: 'Submissions' }]],
  ['/workflows/my-tasks',   [{ label: 'Workflows', to: '/workflows' }, { label: 'My tasks' }]],
  ['/workflows/templates',  [{ label: 'Workflows', to: '/workflows' }, { label: 'Templates' }]],
  ['/workflows',            [{ label: 'Workflows' }]],
  ['/compliance/legal-holds',  [{ label: 'Compliance' }, { label: 'Legal holds' }]],
  ['/compliance/destruction',  [{ label: 'Compliance' }, { label: 'Destruction' }]],
  ['/compliance/retention',    [{ label: 'Compliance' }, { label: 'Retention' }]],
  ['/compliance/overdue',      [{ label: 'Compliance' }, { label: 'Overdue records' }]],
  ['/analytics/audit',  [{ label: 'Analytics', to: '/analytics' }, { label: 'Audit log' }]],
  ['/analytics',        [{ label: 'Analytics' }]],
  ['/admin/users',      [{ label: 'Administration' }, { label: 'Users' }]],
  ['/admin/health',     [{ label: 'Administration' }, { label: 'System health' }]],
  ['/document',         [{ label: 'Documents', to: '/browse' }, { label: 'Record' }]],
  ['/browse',           [{ label: 'Documents' }, { label: 'All files' }]],
  ['/starred',          [{ label: 'Documents', to: '/browse' }, { label: 'Starred' }]],
  ['/shared-with-me',   [{ label: 'Documents', to: '/browse' }, { label: 'Shared with me' }]],
  ['/recent',           [{ label: 'Documents', to: '/browse' }, { label: 'Recent' }]],
  ['/upload',           [{ label: 'Documents', to: '/browse' }, { label: 'Upload' }]],
  ['/search',           [{ label: 'Search' }]],
  ['/inbox',            [{ label: 'Inbox' }]],
  ['/sharing',          [{ label: 'Sharing' }]],
  ['/correspondence',   [{ label: 'Correspondence' }]],
  ['/unauthorized',     [{ label: 'Access denied' }]],
]

function RouteBreadcrumbs({ pathname }: { pathname: string }) {
  if (pathname === '/') return null

  const match = CRUMB_MAP.find(([pattern]) =>
    pathname === pattern || pathname.startsWith(pattern + '/')
  )
  if (!match) return null
  const crumbs = match[1]

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-xs text-muted mb-4 flex-wrap"
    >
      <Link to="/" className="hover:text-[var(--text-primary)] transition-colors">
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <Fragment key={i}>
          <ChevronRight size={12} className="text-muted shrink-0" />
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-[var(--text-primary)] transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className={clsx(
              i === crumbs.length - 1
                ? 'text-[var(--text-primary)] font-medium'
                : 'text-muted'
            )}>
              {crumb.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

export default function DriveLayout() {
  const [mobileNav, setMobileNav] = useState(false)
  const location = useLocation()

  return (
    <div className="h-screen flex flex-col bg-surface overflow-hidden">
      <DriveTopBar onMenuClick={() => setMobileNav(o => !o)} onSearch={() => setMobileNav(false)} />

      <div className="flex flex-1 min-h-0 relative">
        {mobileNav && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileNav(false)}
          />
        )}

        <div
          className={clsx(
            'fixed lg:static inset-y-0 start-0 z-50 lg:z-auto pt-12 lg:pt-0 h-full transition-transform duration-200 lg:translate-x-0',
            mobileNav ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0'
          )}
        >
          <DriveSidebar onNavigate={() => setMobileNav(false)} />
        </div>

        <main className="flex-1 min-w-0 overflow-auto p-4 sm:p-6">
          <div className="max-w-[1600px] mx-auto">
            <RouteBreadcrumbs pathname={location.pathname} />
            <Outlet />
          </div>
        </main>
      </div>

      <SettingsPanel />
    </div>
  )
}
