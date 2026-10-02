import { useState, useRef, useEffect, useCallback, Fragment, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useDriveUI } from "../../context/DriveUIContext"
import { notificationsApi } from '../../api'
import clsx from 'clsx'
import {
  Menu, Search, Bell, Palette, Sun, Moon, ChevronDown,
  User, LogOut, HelpCircle, Shield, X, ChevronRight,
  GitBranch, FileText, AlertCircle, Info, Upload, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { OPEN_PALETTE_EVENT } from "./CommandPalette"
import Logo from '../shared/Logo'

// TailAdmin header action button: circular, bordered
const iconBtn = 'relative flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'

const breadcrumbMap = {
  '/': ['Dashboard'],
  '/browse': ['Documents', 'All files'],
  '/upload': ['Documents', 'Upload'],
  '/starred': ['Documents', 'Starred'],
  '/shared-with-me': ['Documents', 'Shared with me'],
  '/recent': ['Documents', 'Recent'],
  '/search': ['Search'],
  '/inbox': ['Inbox'],
  '/tags': ['Workspace', 'Tags'],
  '/workflows': ['Workflows'],
  '/workflows/my-tasks': ['Workflows', 'My Tasks'],
  '/workflows/templates': ['Workflows', 'Templates'],
  '/submissions': ['Submissions', 'All'],
  '/submissions/new': ['Submissions', 'New'],
  '/submissions/assigned': ['Submissions', 'My assigned'],
  '/submissions/overdue': ['Submissions', 'Overdue / SLA'],
  '/compliance/legal-holds': ['Compliance', 'Legal Holds'],
  '/compliance/destruction': ['Compliance', 'Destruction'],
  '/compliance/retention': ['Compliance', 'Retention'],
  '/compliance/overdue': ['Compliance', 'Disposal queue'],
  '/correspondence': ['Correspondence'],
  '/sharing': ['Sharing'],
  '/analytics': ['Analytics'],
  '/analytics/audit': ['Analytics', 'Audit log'],
  '/admin/users': ['Administration', 'Users'],
  '/admin/health': ['Administration', 'System Health'],
}

function typeIcon(type) {
  if (type === 'workflow') return <GitBranch size={15} className="text-violet-500" />
  if (type === 'record')   return <FileText size={15} className="text-sky-500" />
  if (type === 'alert')    return <AlertCircle size={15} className="text-red-500" />
  return <Info size={15} className="text-primary-500" />
}

const UserMenuItem = memo(function UserMenuItem({ Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
    >
      <Icon size={16} />
      {label}
    </button>
  )
})

export default function Header({ onMenuClick, collapsed = false, onToggleCollapse }) {
  const { isDark, toggleDark, openSettingsPanel } = useTheme()
  const { user, logout } = useAuth()
  const { openUploadDialog } = useDriveUI()
  const canUpload = ["records_officer", "director", "commissioner", "administrator"].includes(user?.role)
  const navigate = useNavigate()
  const location = useLocation()

  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifications, setNotifications] = useState([])
  const notifRef = useRef(null)
  const userRef  = useRef(null)

  const breadcrumbs = breadcrumbMap[location.pathname] || ['Dashboard']

  // Fetch real notifications when dropdown opens
  useEffect(() => {
    if (!notifOpen) return
    notificationsApi.list({ unread: 'true', page_size: 8 })
      .then(({ data }) => setNotifications(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {})
  }, [notifOpen])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current  && !userRef.current.contains(e.target))  setUserOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unreadCount = notifications.filter(n => !n.is_read).length

  const openNotif = (n) => {
    if (!n.is_read) notificationsApi.markRead(n.id).catch(() => {})
    setNotifOpen(false)
    const url = n.related_url || (n.related_record ? `/document/${n.related_record}` : null)
    if (url) navigate(url.startsWith('/') ? url : `/${url}`)
  }

  const handleSignOut = useCallback(async () => {
    setUserOpen(false)
    await logout()
    navigate('/auth/login')
  }, [logout, navigate])

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'
    : 'U'

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  return (
    <header className={clsx(
      'fixed top-0 end-0 start-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30 flex items-center px-4 lg:px-6 gap-3 transition-[inset] duration-300',
      collapsed ? 'lg:start-[5.5rem]' : 'lg:start-64',
    )}>
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Desktop: collapse the sidebar to an icon rail */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden lg:flex p-2 -ms-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-pressed={collapsed}
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>

      {/* Brand */}
      <div className="flex lg:hidden items-center gap-3 shrink-0">
        <Logo size={32} />
        <div className="hidden sm:block">
          <span className="font-bold text-lg text-primary-500 dark:text-slate-300">PSC-DRFMS</span>
          <span className="block text-[10px] text-slate-400 dark:text-slate-500 -mt-1 font-medium tracking-wider uppercase">
            Public Service Commission
          </span>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="hidden md:flex items-center gap-1.5 text-sm whitespace-nowrap shrink-0">
        <span className="text-slate-400 dark:text-slate-500">Home</span>
        {breadcrumbs.map((crumb, i) => (
          <Fragment key={crumb}>
            <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            <span className={clsx(
              i === breadcrumbs.length - 1
                ? 'text-slate-700 dark:text-slate-300 font-medium'
                : 'text-slate-400 dark:text-slate-500'
            )}>
              {crumb}
            </span>
          </Fragment>
        ))}
      </div>

      <div className="flex-1" />

      {/* Search: opens the command palette */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className="hidden md:flex h-10 w-full max-w-md items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 text-start text-sm text-gray-400 transition-colors hover:border-primary-300 hover:bg-white dark:border-gray-800 dark:bg-white/[0.03] dark:hover:bg-white/5"
        aria-label="Search records and commands"
      >
        <Search size={16} className="shrink-0" />
        <span className="flex-1 truncate">Search records, jump to a page…</span>
        <kbd className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className={iconBtn + " md:hidden"}
        aria-label="Search"
      >
        <Search size={18} />
      </button>

      {canUpload && (
        <button
          type="button"
          onClick={() => openUploadDialog()}
          className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium shadow-theme-xs transition-colors"
        >
          <Upload size={16} /> Upload
        </button>
      )}

      {/* Dark mode */}
      <button
        onClick={toggleDark}
        className={iconBtn}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      {/* Notifications bell */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen(o => !o)}
          className={iconBtn}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 w-4 h-4 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute end-0 top-full mt-2 w-80 card shadow-card-lg animate-fade-in z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setNotifOpen(false); navigate('/inbox') }}
                className="font-semibold text-slate-800 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                Inbox
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => notificationsApi.markAllRead().then(() => setNotifications([]))}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">No unread notifications</p>
              ) : notifications.map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotif(n)}
                  className={clsx(
                    'w-full text-start flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors',
                    !n.is_read && 'bg-primary-50/30 dark:bg-primary-900/10'
                  )}
                >
                  <div className="mt-0.5 shrink-0">{typeIcon(n.notification_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-medium truncate', !n.is_read ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{n.message}</p>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 shrink-0" />}
                </button>
              ))}
            </div>

            <div className="p-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setNotifOpen(false); navigate('/inbox') }}
                className="w-full text-center text-xs text-primary-600 dark:text-primary-400 hover:underline py-1.5 font-medium"
              >
                View all in Inbox
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <button
        onClick={openSettingsPanel}
        className={iconBtn}
        title="Appearance" aria-label="Appearance"
      >
        <Palette size={18} />
      </button>

      {/* User dropdown */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setUserOpen(o => !o)}
          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
            <span className="text-white font-semibold text-xs">{initials}</span>
          </div>
          <div className="hidden sm:block text-start">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none truncate max-w-[120px]">
              {user?.full_name || user?.email || 'User'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
              {user?.role?.replace('_', ' ') || ''}
            </p>
          </div>
          <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
        </button>

        {userOpen && (
          <div className="absolute end-0 top-full mt-2 w-56 card shadow-card-lg animate-fade-in z-50">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {user?.full_name || user?.email}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{user?.email}</p>
            </div>
            <div className="py-2">
              <UserMenuItem Icon={User}     label="My Profile"   onClick={() => { setUserOpen(false); navigate('/') }} />
              <UserMenuItem Icon={Shield}   label="Security"     onClick={() => { setUserOpen(false); navigate('/') }} />
              <UserMenuItem Icon={HelpCircle} label="Help"       onClick={() => { setUserOpen(false) }} />
            </div>
            <div className="py-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
