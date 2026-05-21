import { useState, Fragment } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import DriveSidebar from '../drive/DriveSidebar'
import DriveTopBar from '../drive/DriveTopBar'
import SettingsPanel from './SettingsPanel'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'

// Each entry: [pattern, crumbs[]]
// crumbs item: { label, to? }  — no `to` means it's the current/last segment (not linked)
// Ordered most-specific first so the first match wins.
const CRUMB_MAP = [
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

function RouteBreadcrumbs({ pathname }) {
  if (pathname === '/') return null

  const match = CRUMB_MAP.find(([pattern]) =>
    pathname === pattern || pathname.startsWith(pattern + '/')
  )
  if (!match) return null
  const crumbs = match[1]

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mb-4 flex-wrap"
    >
      <Link to="/" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <Fragment key={i}>
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className={clsx(
              i === crumbs.length - 1
                ? 'text-slate-700 dark:text-slate-300 font-medium'
                : 'text-slate-500 dark:text-slate-400'
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
  const isDocumentView = location.pathname.startsWith('/document/')

  return (
    <div className="h-screen flex flex-col bg-[#f3f2f1] dark:bg-slate-950 overflow-hidden">
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

        <main
          className={clsx(
            'flex-1 min-w-0 overflow-auto',
            isDocumentView ? 'p-0' : 'p-4 sm:p-6'
          )}
        >
          {!isDocumentView && (
            <div className="max-w-[1600px] mx-auto h-full">
              <RouteBreadcrumbs pathname={location.pathname} />
              <Outlet />
            </div>
          )}
          {isDocumentView && <Outlet />}
        </main>
      </div>

      <SettingsPanel />
    </div>
  )
}
