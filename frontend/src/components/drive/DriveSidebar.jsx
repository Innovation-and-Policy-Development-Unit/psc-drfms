import { NavLink } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { useTranslation } from 'react-i18next'
import SeriesTree from './SeriesTree'
import clsx from 'clsx'
import {
  Home, FolderOpen, Clock, Upload, Search, Share2,
  CheckCircle, Shield, BarChart3, Settings, Users, Star, Bell, ScrollText,
  Send, PlusCircle, UserCheck, AlertTriangle,
} from 'lucide-react'

const ALL     = ['read_only', 'reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const NO_RO   = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']
const DIRPLUS = ['director', 'commissioner', 'administrator']
const ADMIN   = ['administrator']

const mainNav = [
  { to: '/',               labelKey: 'nav.home',           icon: Home,        end: true, roles: ALL },
  { to: '/browse',         labelKey: 'nav.all_files',      icon: FolderOpen,  roles: NO_RO },
  { to: '/starred',        labelKey: 'nav.starred',        icon: Star,        roles: NO_RO },
  { to: '/shared-with-me', labelKey: 'nav.shared_with_me', icon: Users,       roles: NO_RO },
  { to: '/recent',         labelKey: 'nav.recent',         icon: Clock,       roles: NO_RO },
  { to: '/upload',         labelKey: 'nav.upload',         icon: Upload,      roles: OFFICER },
  { to: '/search',         labelKey: 'nav.search',         icon: Search,      roles: ALL },
  { to: '/inbox',          labelKey: 'nav.inbox',          icon: Bell,        roles: ALL, badge: true },
]

const submissionsNav = [
  { to: '/submissions',          labelKey: 'nav.all_submissions', icon: Send,          roles: OFFICER },
  { to: '/submissions/new',      labelKey: 'nav.new_submission',  icon: PlusCircle,    roles: OFFICER },
  { to: '/submissions/assigned', labelKey: 'nav.my_assigned',     icon: UserCheck,     roles: NO_RO },
  { to: '/submissions/overdue',  labelKey: 'nav.overdue_sla',     icon: AlertTriangle, roles: OFFICER },
]

const moreNav = [
  { to: '/workflows/my-tasks',     labelKey: 'nav.approvals',     icon: CheckCircle, roles: NO_RO },
  { to: '/sharing',                labelKey: 'nav.shared_links',  icon: Share2,      roles: OFFICER },
  { to: '/compliance/legal-holds', labelKey: 'nav.governance',    icon: Shield,      roles: OFFICER },
  { to: '/analytics',              labelKey: 'nav.insights',      icon: BarChart3,    roles: DIRPLUS },
  { to: '/analytics/audit',        labelKey: 'nav.audit_log',     icon: ScrollText,   roles: DIRPLUS },
  { to: '/admin/users',            labelKey: 'nav.admin',         icon: Users,        roles: ADMIN },
]

function NavItem({ to, label, icon: Icon, end, badgeCount }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
      )}
    >
      <Icon size={18} className="shrink-0 opacity-80" />
      <span className="flex-1">{label}</span>
      {badgeCount > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </NavLink>
  )
}

export default function DriveSidebar({ onNavigate }) {
  const { t } = useTranslation()
  const { openSettingsPanel } = useTheme()
  const { user } = useAuth()
  const { unreadCount = 0 } = useNotifications() || {}
  const role = user?.role ?? 'read_only'

  const handleClick = () => onNavigate?.()

  const visibleMain  = mainNav.filter(item => item.roles.includes(role))
  const visibleSubs  = submissionsNav.filter(item => item.roles.includes(role))
  const visibleMore  = moreNav.filter(item => item.roles.includes(role))

  return (
    <aside className="w-60 shrink-0 flex flex-col border-e border-slate-200 dark:border-slate-700 bg-[#f5f5f5] dark:bg-slate-900 h-full">
      <nav className="shrink-0 overflow-y-auto custom-scrollbar p-3 space-y-1 max-h-[45vh]" onClick={handleClick}>
        <p className="px-3 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('nav.section_documents')}
        </p>
        {visibleMain.map(item => (
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
            <p className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('nav.section_submissions')}
            </p>
            {visibleSubs.map(item => (
              <NavItem
                key={item.to}
                to={item.to}
                label={t(item.labelKey)}
                icon={item.icon}
              />
            ))}
          </>
        )}

        {visibleMore.length > 0 && (
          <>
            <p className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('nav.section_more')}
            </p>
            {visibleMore.map(item => (
              <NavItem
                key={item.to}
                to={item.to}
                label={t(item.labelKey)}
                icon={item.icon}
              />
            ))}
          </>
        )}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border-t border-slate-200 dark:border-slate-700">
        <SeriesTree onNavigate={onNavigate} />
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
        <button
          type="button"
          onClick={() => { openSettingsPanel(); handleClick() }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60"
        >
          <Settings size={18} />
          {t('nav.settings')}
        </button>
      </div>
    </aside>
  )
}
