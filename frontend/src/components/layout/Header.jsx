import { useState, useRef, useEffect, useCallback, Fragment, memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import clsx from 'clsx'
import {
  Menu, Search, Bell, Settings, Sun, Moon, ChevronDown,
  User, LogOut, CreditCard, HelpCircle, Shield, X,
  CheckCircle2, AlertCircle, Info, Package, ChevronRight
} from 'lucide-react'
import Logo from '../shared/Logo'

const notifications = [
  { id: 1, type: 'success', title: 'Order Completed', message: 'Order #1234 has been fulfilled', time: '2 min ago', read: false },
  { id: 2, type: 'info', title: 'New User Registered', message: 'Sarah Johnson joined the platform', time: '15 min ago', read: false },
  { id: 3, type: 'warning', title: 'Low Stock Alert', message: 'Product "Wireless Mouse" is running low', time: '1 hr ago', read: true },
  { id: 4, type: 'error', title: 'Payment Failed', message: 'Transaction #5678 was declined', time: '3 hr ago', read: true },
  { id: 5, type: 'info', title: 'System Update', message: 'Dashboard updated to v2.1.0', time: '1 day ago', read: true },
]

const breadcrumbMap = {
  '/': ['Dashboard'],
  '/records': ['Records', 'All Records'],
  '/records/upload': ['Records', 'Upload'],
  '/records/series': ['Records', 'Series'],
  '/workflows': ['Workflows'],
  '/workflows/my-tasks': ['Workflows', 'My Tasks'],
  '/search': ['Search'],
  '/compliance/legal-holds': ['Compliance', 'Legal Holds'],
  '/compliance/destruction': ['Compliance', 'Destruction'],
  '/compliance/retention': ['Compliance', 'Retention'],
  '/compliance/overdue': ['Compliance', 'Overdue'],
  '/correspondence': ['Correspondence'],
  '/sharing': ['Sharing'],
  '/analytics': ['Analytics'],
  '/analytics/audit': ['Analytics', 'Audit Trail'],
  '/analytics/compliance': ['Analytics', 'Compliance Report'],
  '/admin/users': ['Administration', 'Users'],
  '/admin/health': ['Administration', 'System Health'],
  '/admin/departments': ['Administration', 'Departments'],
  '/admin/api-keys': ['Administration', 'API Keys'],
}

function NotificationIcon({ type }) {
  if (type === 'success') return <CheckCircle2 size={16} className="text-emerald-500" />
  if (type === 'warning') return <AlertCircle size={16} className="text-amber-500" />
  if (type === 'error') return <AlertCircle size={16} className="text-red-500" />
  return <Info size={16} className="text-cyan-500" />
}

const UserMenuItem = memo(function UserMenuItem({ Icon, label, path, onClick }) {
  const handleClick = useCallback(() => onClick(path), [onClick, path])
  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
    >
      <Icon size={16} />
      {label}
    </button>
  )
})

export default function Header({ onMenuClick }) {
  const { isDark, toggleDark, openSettingsPanel } = useTheme()
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const notifRef = useRef(null)
  const userRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const breadcrumbs = breadcrumbMap[location.pathname] || ['Dashboard']
  const unreadCount = notifications.filter(n => !n.read).length

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchChange = useCallback(e => setSearchQuery(e.target.value), [])
  const handleSearchClose = useCallback(() => { setSearchOpen(false); setSearchQuery('') }, [])
  const handleSearchOpen = useCallback(() => setSearchOpen(true), [])
  const handleNotifToggle = useCallback(() => setNotifOpen(o => !o), [])
  const handleUserToggle = useCallback(() => setUserOpen(o => !o), [])
  const handleSignOut = useCallback(() => navigate('/auth/login'), [navigate])

  const userMenuItems = [
    { icon: User, label: 'My Profile', path: '/pages/account' },
    { icon: CreditCard, label: 'Billing', path: '/pages/pricing' },
    { icon: Shield, label: 'Security', path: '/pages/account' },
    { icon: HelpCircle, label: 'Help Center', path: '/pages/faq' },
  ]
  const handleUserMenuClick = useCallback((path) => {
    navigate(path)
    setUserOpen(false)
  }, [navigate])

  return (
    <header className="fixed top-0 end-0 start-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-30 flex items-center px-4 gap-3">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        <Logo size={32} />
        <div className="hidden sm:block">
          <span className="font-bold text-lg text-primary-500 dark:text-slate-300">PSC-DRFMS</span>
          <span className="block text-[10px] text-slate-400 dark:text-slate-500 -mt-1 font-medium tracking-wider uppercase">
            Public Service Commission
          </span>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="hidden md:flex items-center gap-1.5 text-sm">
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

      {/* Search */}
      <div className="relative">
        {searchOpen ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <input
              type="text"
              placeholder="Search..."
              autoFocus
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-48 sm:w-64 input text-sm"
            />
            <button
              onClick={handleSearchClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleSearchOpen}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <Search size={20} />
          </button>
        )}
      </div>

      {/* Dark mode toggle */}
      <button
        onClick={toggleDark}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={handleNotifToggle}
          className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute end-0 top-full mt-2 w-80 card shadow-card-lg animate-fade-in z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Notifications</h3>
              <span className="badge badge-primary">{unreadCount} new</span>
            </div>
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  className={clsx(
                    'flex items-start gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors',
                    !notif.read && 'bg-primary-50/30 dark:bg-primary-900/10'
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <NotificationIcon type={notif.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-medium truncate', !notif.read ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400')}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{notif.message}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{notif.time}</p>
                  </div>
                  {!notif.read && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full mt-1 shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-slate-700">
              <button className="w-full text-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium py-1">
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings panel trigger */}
      <button
        onClick={openSettingsPanel}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
        title="Settings"
      >
        <Settings size={20} />
      </button>

      {/* User dropdown */}
      <div className="relative" ref={userRef}>
        <button
          onClick={handleUserToggle}
          className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
            <span className="text-white font-semibold text-xs">JD</span>
          </div>
          <div className="hidden sm:block text-start">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">John Doe</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Admin</p>
          </div>
          <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
        </button>

        {userOpen && (
          <div className="absolute end-0 top-full mt-2 w-56 card shadow-card-lg animate-fade-in z-50">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-200">John Doe</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">john@liner.com</p>
            </div>
            <div className="py-2">
              {userMenuItems.map(({ icon: Icon, label, path }) => (
                <UserMenuItem
                  key={label}
                  Icon={Icon}
                  label={label}
                  path={path}
                  onClick={handleUserMenuClick}
                />
              ))}
            </div>
            <div className="py-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
