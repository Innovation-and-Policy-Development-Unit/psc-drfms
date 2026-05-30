import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Menu } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useNotifications } from '@/context/NotificationContext'
import { useDriveUI } from '@/context/DriveUIContext'
import { notificationsApi } from '@/api'
import type { NotificationItem } from '@/types/api'
import Logo from '../shared/Logo'
import clsx from 'clsx'

interface DriveTopBarProps {
  onMenuClick?: () => void
  onSearch?: () => void
}

export default function DriveTopBar({ onMenuClick, onSearch }: DriveTopBarProps) {
  const { user, logout } = useAuth()
  const { isDark, toggleDark } = useTheme()
  const { unreadCount = 0 } = useNotifications() ?? {}
  const { toggleSidebar, openUploadDialog } = useDriveUI()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [userOpen, setUserOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const userRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!notifOpen) return
    notificationsApi.list({ unread: 'true', page_size: 10 })
      .then(({ data }) => {
        const list = 'results' in data && data.results ? data.results : (data as NotificationItem[])
        setNotifications(list.slice(0, 10))
      })
      .catch(() => {})
  }, [notifOpen])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      onSearch?.()
    }
  }

  const initials = user
    ? `${user.firstName?.[0] ?? user.first_name?.[0] ?? ''}${user.lastName?.[0] ?? user.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U'

  const displayName = user?.fullName ?? user?.full_name ?? user?.email ?? ''

  const handleLogout = async () => {
    await logout()
    navigate('/auth/login')
  }

  const openNotif = (n: NotificationItem) => {
    const isRead = n.isRead ?? n.is_read
    if (!isRead) notificationsApi.markRead(String(n.id)).catch(() => {})
    setNotifOpen(false)
    const relatedUrl = n.relatedUrl ?? n.related_url
    const relatedRecord = n.relatedRecord ?? n.related_record
    const url = relatedUrl || (relatedRecord ? `/document/${relatedRecord}` : '/')
    navigate(url.startsWith('/') ? url : `/${url}`)
  }

  return (
    <header className="h-14 shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 border-b border-registry bg-raised z-20">
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden p-2 -ms-1 rounded-md hover:bg-[var(--surface-sunken)] text-muted"
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>

      <button
        type="button"
        onClick={toggleSidebar}
        className="hidden lg:flex p-2 rounded-md hover:bg-[var(--surface-sunken)] text-muted"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity me-1">
        <Logo size={28} />
      </Link>

      <form onSubmit={handleSearch} className="drive-search-pill flex-1 mx-auto max-w-2xl">
        <Search size={16} className="drive-search-icon" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in Cloud Drive"
          className="w-full"
        />
      </form>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => openUploadDialog()}
          className="hidden sm:inline-flex btn-primary btn-sm rounded-full px-4"
        >
          Upload
        </button>

        <button type="button" onClick={toggleDark} className="btn-ghost btn-sm text-xs hidden md:inline-flex">
          {isDark ? 'Light' : 'Dark'}
        </button>

        <div className="relative" ref={notifRef}>
          <button type="button" onClick={() => setNotifOpen((o) => !o)} className="btn-ghost btn-sm relative text-xs">
            Inbox
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 text-white text-[10px] font-medium rounded-full flex items-center justify-center tabular-nums" style={{ background: 'var(--brand-mega)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute end-0 top-full mt-1 w-80 panel z-50 p-0 overflow-hidden shadow-lg">
              <div className="flex items-center justify-between px-4 py-3 border-b border-registry">
                <span className="text-sm font-medium">Notifications</span>
                <button type="button" onClick={() => notificationsApi.markAllRead().then(() => setNotifications([]))} className="text-xs text-[var(--brand-navy)] hover:underline">
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted text-center">No new notifications</p>
                ) : (
                  notifications.map((n) => {
                    const isRead = n.isRead ?? n.is_read
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openNotif(n)}
                        className={clsx(
                          'w-full text-start px-4 py-3 border-b border-registry last:border-0 hover:bg-[var(--surface-sunken)]',
                          !isRead && 'bg-[var(--surface-sunken)]',
                        )}
                      >
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted truncate mt-0.5">{n.message}</p>
                      </button>
                    )
                  })
                )}
              </div>
              <div className="p-2 border-t border-registry">
                <button type="button" onClick={() => { setNotifOpen(false); navigate('/inbox') }} className="w-full text-center text-xs text-[var(--brand-navy)] hover:underline py-1.5">
                  View all
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button type="button" onClick={() => setUserOpen((o) => !o)} className="flex items-center p-1 rounded-full hover:bg-[var(--surface-sunken)]">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold" style={{ background: 'var(--brand-mega)' }}>
              {initials}
            </div>
          </button>
          {userOpen && (
            <div className="absolute end-0 top-full mt-1 w-52 panel py-1 z-50 shadow-lg">
              <div className="px-4 py-3 border-b border-registry">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted truncate capitalize mt-0.5">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
              <div className="py-1">
                <button type="button" onClick={() => { setUserOpen(false); navigate('/inbox') }} className="w-full text-start px-4 py-2 text-sm hover:bg-[var(--surface-sunken)]">
                  Inbox {unreadCount > 0 && <span className="float-end text-muted tabular-nums">{unreadCount}</span>}
                </button>
                <button type="button" onClick={() => { setUserOpen(false); navigate('/auth/two-factor') }} className="w-full text-start px-4 py-2 text-sm hover:bg-[var(--surface-sunken)]">
                  Security / 2FA
                </button>
              </div>
              <div className="py-1 border-t border-registry">
                <button type="button" onClick={handleLogout} className="w-full text-start px-4 py-2 text-sm text-[var(--status-danger-fg)] hover:bg-[var(--surface-sunken)]">
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
