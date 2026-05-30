import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useNotifications } from '@/context/NotificationContext'
import { notificationsApi } from '@/api'
import type { NotificationItem } from '@/types/api'
import Logo from '../shared/Logo'
import clsx from 'clsx'
import { Menu } from 'lucide-react'

interface DriveTopBarProps {
  onMenuClick?: () => void
  onSearch?: () => void
}

export default function DriveTopBar({ onMenuClick, onSearch }: DriveTopBarProps) {
  const { user, logout } = useAuth()
  const { isDark, toggleDark } = useTheme()
  const { unreadCount = 0 } = useNotifications() ?? {}
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
    const isRead = n.isRead ?? (n as { is_read?: boolean }).is_read
    if (!isRead) notificationsApi.markRead(String(n.id)).catch(() => {})
    setNotifOpen(false)
    const relatedUrl = n.relatedUrl ?? (n as { related_url?: string }).related_url
    const relatedRecord = n.relatedRecord ?? (n as { related_record?: string }).related_record
    const url = relatedUrl || (relatedRecord ? `/document/${relatedRecord}` : '/')
    navigate(url.startsWith('/') ? url : `/${url}`)
  }

  return (
    <header className="h-12 shrink-0 flex items-center gap-3 px-3 sm:px-4 border-b border-registry bg-surface">
      <button
        type="button"
        onClick={onMenuClick}
        className="lg:hidden p-2 -ms-1 rounded-sm hover:bg-[var(--bg-muted)] text-muted"
        aria-label="Menu"
      >
        <Menu size={18} />
      </button>

      <Link to="/" className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity">
        <Logo size={26} />
        <span className="hidden sm:block font-serif text-sm font-semibold text-[var(--text-primary)]">
          PSC Registry
        </span>
      </Link>

      <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto hidden sm:block">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search records…"
          className="input h-9 text-sm w-full"
        />
      </form>

      <div className="flex items-center gap-1 shrink-0 ms-auto">
        <button
          type="button"
          onClick={() => navigate('/upload')}
          className="hidden sm:inline-flex btn-primary btn-sm"
        >
          Upload
        </button>

        <button
          type="button"
          onClick={toggleDark}
          className="btn-ghost btn-sm text-xs hidden sm:inline-flex"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? 'Light' : 'Dark'}
        </button>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            className="btn-ghost btn-sm relative text-xs"
          >
            Inbox
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 bg-[var(--brand-navy)] text-white text-[10px] font-medium rounded-sm flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute end-0 top-full mt-1 w-80 panel z-50 p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-registry">
                <span className="text-sm font-medium">Notifications</span>
                <button
                  type="button"
                  onClick={() => notificationsApi.markAllRead().then(() => setNotifications([]))}
                  className="text-xs text-[var(--brand-navy)] hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-muted text-center">No new notifications</p>
                ) : (
                  notifications.map((n) => {
                    const isRead = n.isRead ?? (n as { is_read?: boolean }).is_read
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openNotif(n)}
                        className={clsx(
                          'w-full text-start px-4 py-3 border-b border-registry last:border-0 hover:bg-[var(--bg-muted)] transition-colors',
                          !isRead && 'bg-[var(--bg-accent)]',
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
                <button
                  type="button"
                  onClick={() => { setNotifOpen(false); navigate('/inbox') }}
                  className="w-full text-center text-xs text-[var(--brand-navy)] hover:underline py-1.5"
                >
                  View all
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen((o) => !o)}
            className="flex items-center gap-2 p-1 rounded-sm hover:bg-[var(--bg-muted)]"
          >
            <div className="w-7 h-7 rounded-sm bg-[var(--brand-navy)] flex items-center justify-center text-white text-[10px] font-semibold">
              {initials}
            </div>
          </button>
          {userOpen && (
            <div className="absolute end-0 top-full mt-1 w-52 panel py-1 z-50">
              <div className="px-4 py-3 border-b border-registry">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted truncate capitalize mt-0.5">
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => { setUserOpen(false); navigate('/inbox') }}
                  className="w-full text-start px-4 py-2 text-sm hover:bg-[var(--bg-muted)]"
                >
                  Inbox
                  {unreadCount > 0 && (
                    <span className="float-end text-[10px] tabular-nums text-muted">{unreadCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setUserOpen(false); navigate('/auth/two-factor') }}
                  className="w-full text-start px-4 py-2 text-sm hover:bg-[var(--bg-muted)]"
                >
                  Security / 2FA
                </button>
              </div>
              <div className="py-1 border-t border-registry">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-start px-4 py-2 text-sm text-[var(--status-danger-fg)] hover:bg-[var(--bg-muted)]"
                >
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
