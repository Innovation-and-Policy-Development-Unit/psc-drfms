import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Cloud, Home, Star, Users, Clock, Upload, Search, Inbox,
  FileStack, CheckSquare, Link2, Shield, BarChart3, ScrollText, Settings, PanelLeftClose, PanelLeft,
} from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationContext'
import { useDriveUI } from '@/context/DriveUIContext'
import { useTranslation } from 'react-i18next'
import SeriesTree from './SeriesTree'
import clsx from 'clsx'
import type { UserRole } from '@/types/api'
import type { LucideIcon } from 'lucide-react'

const ALL: UserRole[] = ['read_only', 'reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const NO_RO: UserRole[] = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const OFFICER: UserRole[] = ['records_officer', 'director', 'commissioner', 'administrator']
const DIRPLUS: UserRole[] = ['director', 'commissioner', 'administrator']
const ADMIN: UserRole[] = ['administrator']

interface NavDef {
  to: string
  labelKey: string
  icon: LucideIcon
  end?: boolean
  roles: UserRole[]
  badge?: boolean
}

const mainNav: NavDef[] = [
  { to: '/', labelKey: 'nav.home', icon: Home, end: true, roles: ALL },
  { to: '/browse', labelKey: 'nav.all_files', icon: Cloud, roles: NO_RO },
  { to: '/starred', labelKey: 'nav.starred', icon: Star, roles: NO_RO },
  { to: '/shared-with-me', labelKey: 'nav.shared_with_me', icon: Users, roles: NO_RO },
  { to: '/recent', labelKey: 'nav.recent', icon: Clock, roles: NO_RO },
  { to: '/upload', labelKey: 'nav.upload', icon: Upload, roles: OFFICER },
  { to: '/search', labelKey: 'nav.search', icon: Search, roles: ALL },
  { to: '/inbox', labelKey: 'nav.inbox', icon: Inbox, roles: ALL, badge: true },
]

const submissionsNav: NavDef[] = [
  { to: '/submissions', labelKey: 'nav.all_submissions', icon: FileStack, roles: OFFICER },
  { to: '/submissions/new', labelKey: 'nav.new_submission', icon: Upload, roles: OFFICER },
  { to: '/submissions/assigned', labelKey: 'nav.my_assigned', icon: CheckSquare, roles: NO_RO },
  { to: '/submissions/overdue', labelKey: 'nav.overdue_sla', icon: Clock, roles: OFFICER },
]

const moreNav: NavDef[] = [
  { to: '/workflows/my-tasks', labelKey: 'nav.approvals', icon: CheckSquare, roles: NO_RO },
  { to: '/sharing', labelKey: 'nav.shared_links', icon: Link2, roles: OFFICER },
  { to: '/compliance/legal-holds', labelKey: 'nav.governance', icon: Shield, roles: OFFICER },
  { to: '/analytics', labelKey: 'nav.insights', icon: BarChart3, roles: DIRPLUS },
  { to: '/analytics/audit', labelKey: 'nav.audit_log', icon: ScrollText, roles: DIRPLUS },
  { to: '/admin/users', labelKey: 'nav.admin', icon: Settings, roles: ADMIN },
]

function NavItem({ to, label, icon: Icon, end = false, badgeCount = 0 }: {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badgeCount?: number
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => clsx('drive-nav-item', isActive && 'active')} title={label}>
      <Icon size={18} strokeWidth={1.75} className="shrink-0" />
      <span className="drive-nav-label flex-1 truncate">{label}</span>
      {badgeCount > 0 && (
        <span className="drive-nav-label min-w-[18px] h-[18px] px-1 rounded-sm text-white text-[10px] font-medium flex items-center justify-center tabular-nums"
          style={{ background: 'var(--brand-mega)' }}
        >
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
  const { sidebarCollapsed, toggleSidebar } = useDriveUI()
  const role = user?.role ?? 'read_only'

  const visibleMain = mainNav.filter((item) => item.roles.includes(role))
  const visibleSubs = submissionsNav.filter((item) => item.roles.includes(role))
  const visibleMore = moreNav.filter((item) => item.roles.includes(role))

  return (
    <aside className={clsx('drive-sidebar relative', sidebarCollapsed && 'collapsed')}>
      <div className="px-3 py-3 border-b border-registry shrink-0 flex items-center gap-2">
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-serif text-sm font-semibold tracking-tight truncate text-white">Cloud Drive</p>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-sidebar-muted)' }}>PSC Registry</p>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="btn-ghost btn-sm p-1.5 hidden lg:flex shrink-0"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="shrink-0 overflow-y-auto custom-scrollbar py-2 space-y-0.5 max-h-[38vh]" onClick={() => onNavigate?.()}>
        <p className="drive-section-label px-4 pt-1 pb-1 label-overline">{t('nav.section_documents')}</p>
        {visibleMain.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            label={t(item.labelKey)}
            icon={item.icon}
            end={item.end}
            badgeCount={item.badge ? unreadCount : 0}
          />
        ))}

        {visibleSubs.length > 0 && (
          <>
            <p className="drive-section-label px-4 pt-3 pb-1 label-overline">{t('nav.section_submissions')}</p>
            {visibleSubs.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.labelKey)} icon={item.icon} />
            ))}
          </>
        )}

        {visibleMore.length > 0 && (
          <>
            <p className="drive-section-label px-4 pt-3 pb-1 label-overline">{t('nav.section_more')}</p>
            {visibleMore.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.labelKey)} icon={item.icon} />
            ))}
          </>
        )}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border-t border-registry">
        <SeriesTree onNavigate={onNavigate} collapsed={sidebarCollapsed} />
      </div>

      <div className="p-2 border-t border-registry shrink-0">
        <button
          type="button"
          onClick={() => { openSettingsPanel(); onNavigate?.() }}
          className="drive-nav-item w-full"
          title={t('nav.settings')}
        >
          <Settings size={18} strokeWidth={1.75} />
          <span className="drive-nav-label">{t('nav.settings')}</span>
        </button>
      </div>
    </aside>
  )
}

export default memo(DriveSidebarComponent)
