import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { notificationsApi } from '../../api'
import Logo from '../shared/Logo'
import clsx from 'clsx'
import {
  Search, Upload, Bell, Sun, Moon, Menu, LogOut, ChevronDown
} from 'lucide-react'

export default function DriveTopBar({ onMenuClick, onSearch }) {
  const { user, logout } = useAuth()
  const { isDark, toggleDark } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [userOpen, setUserOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const userRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    notificationsApi.list({ unread: 'true', page_size: 10 })
      .then(({ data }) => setNotifications((data.results || data).slice(0, 10)))
      .catch(() => {})
  }, [notifOpen])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      onSearch?.()
    }
  }

  const initials = user
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U'
    : 'U'

  const handleLogout = async () => {
    await logout()
    navigate('/auth/login')
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  const openNotif = (n) => {
    if (!n.is_read) notificationsApi.markRead(n.id).catch(() => {})
    setNotifOpen(false)
    const url = n.related_url || (n.related_record ? `/document/${n.related_record}` : '/')
    navigate(url.startsWith('/') ? url : `/${url}`)
  }

  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600"
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <Logo size={28} />
        <span className="hidden sm:block font-semibold text-slate-800 dark:text-white text-sm">
          PSC Documents
        </span>
      </div>

      <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-auto hidden sm:block">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search in Documents"
            className="w-full h-9 pl-9 pr-4 rounded-md bg-slate-100 dark:bg-slate-900 border-0 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
      </form>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/upload')}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium"
        >
          <Upload size={16} />
          Upload
        </button>

        <button
          type="button"
          onClick={toggleDark}
          className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 end-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute end-0 top-full mt-1 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</span>
                <button
                  type="button"
                  onClick={() => notificationsApi.markAllRead().then(() => setNotifications([]))}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">No new notifications</p>
                ) : notifications.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotif(n)}
                    className={clsx(
                      'w-full text-start px-4 py-3 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30',
                      !n.is_read && 'bg-primary-50/50 dark:bg-primary-900/10'
                    )}
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{n.message}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen(o => !o)}
            className="flex items-center gap-2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden md:block" />
          </button>
          {userOpen && (
            <div className="absolute end-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
