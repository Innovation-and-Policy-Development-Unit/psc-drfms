import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'
import { useTranslation } from 'react-i18next'
import SeriesTree from './SeriesTree'
import clsx from 'clsx'
import type { UserRole } from '@/types/api'

const ALL: UserRole[] = ['read_only', 'reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const NO_RO: UserRole[] = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const OFFICER: UserRole[] = ['records_officer', 'director', 'commissioner', 'administrator']
const DIRPLUS: UserRole[] = ['director', 'commissioner', 'administrator']
const ADMIN: UserRole[] = ['administrator']

interface NavDef {
  to: string
  labelKey: string
  end?: boolean
  roles: UserRole[]
  badge?: boolean
}

const mainNav: NavDef[] = [
  { to: '/', labelKey: 'nav.home', end: true, roles: ALL },
  { to: '/browse', labelKey: 'nav.all_files', roles: NO_RO },
  { to: '/starred', labelKey: 'nav.starred', roles: NO_RO },
  { to: '/shared-with-me', labelKey: 'nav.shared_with_me', roles: NO_RO },
  { to: '/recent', labelKey: 'nav.recent', roles: NO_RO },
  { to: '/upload', labelKey: 'nav.upload', roles: OFFICER },
  { to: '/search', labelKey: 'nav.search', roles: ALL },
  { to: '/inbox', labelKey: 'nav.inbox', roles: ALL, badge: true },
]

const submissionsNav: NavDef[] = [
  { to: '/submissions', labelKey: 'nav.all_submissions', roles: OFFICER },
  { to: '/submissions/new', labelKey: 'nav.new_submission', roles: OFFICER },
  { to: '/submissions/assigned', labelKey: 'nav.my_assigned', roles: NO_RO },
  { to: '/submissions/overdue', labelKey: 'nav.overdue_sla', roles: OFFICER },
]

const moreNav: NavDef[] = [
  { to: '/workflows/my-tasks', labelKey: 'nav.approvals', roles: NO_RO },
  { to: '/sharing', labelKey: 'nav.shared_links', roles: OFFICER },
  { to: '/compliance/legal-holds', labelKey: 'nav.governance', roles: OFFICER },
  { to: '/analytics', labelKey: 'nav.insights', roles: DIRPLUS },
  { to: '/analytics/audit', labelKey: 'nav.audit_log', roles: DIRPLUS },
  { to: '/admin/users', labelKey: 'nav.admin', roles: ADMIN },
]

function NavItem({ to, label, end = false, badgeCount = 0 }: {
  to: string
  label: string
  end?: boolean
  badgeCount?: number
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => clsx('nav-link', isActive && 'active')}>
      <span className="flex-1">{label}</span>
      {badgeCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-sm bg-[var(--brand-navy)] text-white text-[10px] font-medium flex items-center justify-center tabular-nums">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </NavLink>
  )
}

function DriveSidebarComponent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { openSettingsPanel } = useTheme()
  const { user } = useAuth()
  const { unreadCount = 0 } = useNotifications()
  const role = user?.role ?? 'read_only'

  const visibleMain = mainNav.filter((item) => item.roles.includes(role))
  const visibleSubs = submissionsNav.filter((item) => item.roles.includes(role))
  const visibleMore = moreNav.filter((item) => item.roles.includes(role))

  return (
    <aside className="w-56 shrink-0 flex flex-col border-e border-registry bg-raised h-full">
      <div className="px-4 py-4 border-b border-registry">
        <p className="font-serif text-sm font-semibold tracking-tight">PSC-DRFMS</p>
        <p className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Records registry</p>
      </div>

      <nav className="shrink-0 overflow-y-auto custom-scrollbar p-2 space-y-0.5 max-h-[42vh]" onClick={() => onNavigate?.()}>
        <p className="px-3 pt-2 pb-1 label-overline">{t('nav.section_documents')}</p>
        {visibleMain.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={t(item.labelKey)}
            end={item.end}
            badgeCount={item.badge ? unreadCount : 0}
          />
        ))}

        {visibleSubs.length > 0 && (
          <>
            <p className="px-3 pt-4 pb-1 label-overline">{t('nav.section_submissions')}</p>
            {visibleSubs.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.labelKey)} />
            ))}
          </>
        )}

        {visibleMore.length > 0 && (
          <>
            <p className="px-3 pt-4 pb-1 label-overline">{t('nav.section_more')}</p>
            {visibleMore.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.labelKey)} />
            ))}
          </>
        )}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border-t border-registry">
        <SeriesTree onNavigate={onNavigate} />
      </div>

      <div className="p-2 border-t border-registry shrink-0">
        <button type="button" onClick={() => { openSettingsPanel(); onNavigate?.() }} className="nav-link w-full">
          {t('nav.settings')}
        </button>
      </div>
    </aside>
  )
}

export default memo(DriveSidebarComponent)
