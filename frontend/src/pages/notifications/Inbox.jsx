import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../../api'
import { useNotifications } from '../../context/NotificationContext'
import clsx from 'clsx'
import {
  Bell, Check, CheckCheck, ExternalLink,
  FileText, GitBranch, Shield, Users, Info, AlertCircle,
} from 'lucide-react'

const TYPE_META = {
  workflow:   { icon: GitBranch,    label: 'Workflow',   color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400' },
  legal_hold: { icon: Shield,       label: 'Legal Hold', color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' },
  record:     { icon: FileText,     label: 'Record',     color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400' },
  user:       { icon: Users,        label: 'User',       color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' },
  system:     { icon: Info,         label: 'System',     color: 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400' },
  alert:      { icon: AlertCircle,  label: 'Alert',      color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const PAGE_SIZE = 25

export default function Inbox() {
  const navigate = useNavigate()
  const { markRead: wsMarkRead } = useNotifications() || {}
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (filter === 'unread') params.unread = 'true'
      const { data } = await notificationsApi.list(params)
      const results = Array.isArray(data) ? data : (data.results ?? [])
      setItems(results)
      setCount(data.count ?? results.length)
    } catch {
      // keep stale items
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const applyMarkRead = (id) => {
    wsMarkRead?.(id)
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const handleMarkRead = async (e, n) => {
    e.stopPropagation()
    if (n.is_read) return
    await notificationsApi.markRead(n.id).catch(() => {})
    applyMarkRead(n.id)
  }

  const handleOpen = async (n) => {
    if (!n.is_read) {
      await notificationsApi.markRead(n.id).catch(() => {})
      applyMarkRead(n.id)
    }
    const url = n.related_url || (n.related_record ? `/document/${n.related_record}` : null)
    if (url) navigate(url.startsWith('/') ? url : `/${url}`)
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const changeFilter = (val) => { setFilter(val); setPage(1) }

  const unreadInView = items.filter(n => !n.is_read).length
  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inbox</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Workflow alerts, approvals, and system messages
          </p>
        </div>
        {unreadInView > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
        {[['all', 'All'], ['unread', 'Unread']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => changeFilter(val)}
            className={clsx(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === val
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Bell size={36} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-medium text-slate-600 dark:text-slate-400">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Workflow actions and system alerts will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {items.map(n => {
              const meta = TYPE_META[n.notification_type] ?? TYPE_META.system
              const TypeIcon = meta.icon
              const hasLink = !!(n.related_url || n.related_record)
              return (
                <li
                  key={n.id}
                  className={clsx(
                    'flex items-start gap-4 px-5 py-4 transition-colors group',
                    !n.is_read && 'bg-primary-50/40 dark:bg-primary-900/10',
                    hasLink && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  )}
                  onClick={() => hasLink && handleOpen(n)}
                >
                  <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.color)}>
                    <TypeIcon size={16} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={clsx(
                        'text-sm font-medium',
                        n.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                      )}>
                        {n.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                        {!n.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
                      </div>
                    </div>

                    {n.message && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                        {meta.label}
                      </span>
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={e => handleMarkRead(e, n)}
                          className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                        >
                          <Check size={11} />
                          Mark read
                        </button>
                      )}
                      {hasLink && (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink size={11} />
                          Open
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{count} total</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
