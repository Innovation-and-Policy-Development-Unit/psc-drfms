import { useState, useEffect, useCallback, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { notificationsApi, unwrapList } from '@/api'
import { useNotifications } from '@/context/NotificationContext'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { NotificationCategoryBadge, timeAgo } from '@/lib/notificationTypes'

interface NotificationItem {
  id: string | number
  title: string
  message?: string
  notificationType?: string
  notification_type?: string
  isRead?: boolean
  is_read?: boolean
  relatedUrl?: string
  related_url?: string
  relatedRecord?: string
  related_record?: string
  createdAt?: string
  created_at?: string
}

const PAGE_SIZE = 25

export default function Inbox() {
  const navigate = useNavigate()
  const { markRead: wsMarkRead } = useNotifications() || {}
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
      if (filter === 'unread') params.unread = 'true'
      const { data } = await notificationsApi.list(params)
      const results = unwrapList<NotificationItem>(data)
      setItems(results)
      setCount((data as { count?: number }).count ?? results.length)
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const isRead = (n: NotificationItem) => n.isRead ?? n.is_read ?? false
  const notifType = (n: NotificationItem) => n.notificationType ?? n.notification_type ?? 'system'
  const created = (n: NotificationItem) => n.createdAt ?? n.created_at

  const applyMarkRead = (id: string | number) => {
    wsMarkRead?.(String(id))
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true, is_read: true } : n)))
  }

  const handleMarkRead = async (e: MouseEvent, n: NotificationItem) => {
    e.stopPropagation()
    if (isRead(n)) return
    await notificationsApi.markRead(`${n.id}`).catch(() => {})
    applyMarkRead(n.id)
  }

  const handleOpen = async (n: NotificationItem) => {
    if (!isRead(n)) {
      await notificationsApi.markRead(`${n.id}`).catch(() => {})
      applyMarkRead(n.id)
    }
    const related = n.relatedUrl ?? n.related_url
    const record = n.relatedRecord ?? n.related_record
    const url = related || (record ? `/document/${record}` : null)
    if (url) navigate(url.startsWith('/') ? url : `/${url}`)
  }

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true, is_read: true })))
  }

  const unreadInView = items.filter((n) => !isRead(n)).length
  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <PageShell
      title="Inbox"
      subtitle="Workflow alerts, approvals, and system messages."
      action={
        unreadInView > 0 ? (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        ) : undefined
      }
    >
      <div className="max-w-3xl space-y-4">
        <div className="flex gap-2">
          {[['all', 'All'], ['unread', 'Unread']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => { setFilter(val); setPage(1) }}
              className={clsx(
                'btn-sm border',
                filter === val
                  ? 'border-[var(--brand-navy)] bg-[var(--surface-sunken)] font-medium'
                  : 'border-registry btn-secondary',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Panel padding={false} className="overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              description="Workflow and system messages will appear here."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {items.map((n) => {
                const hasLink = !!(n.relatedUrl ?? n.related_url ?? n.relatedRecord ?? n.related_record)
                const read = isRead(n)
                return (
                  <li
                    key={n.id}
                    className={clsx(
                      'px-4 py-3 transition-colors',
                      !read && 'bg-[var(--surface-sunken)]',
                      hasLink && 'cursor-pointer hover:bg-[var(--surface-sunken)]',
                    )}
                    onClick={() => hasLink && handleOpen(n)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={clsx('text-sm font-medium', read && 'text-secondary')}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <NotificationCategoryBadge type={notifType(n)} />
                          {!read && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkRead(e, n)}
                              className="text-xs text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))] hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted whitespace-nowrap shrink-0">
                        {timeAgo(created(n))}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{count} total</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span>{page} / {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
