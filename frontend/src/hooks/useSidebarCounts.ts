import { useCallback, useEffect, useState } from 'react'
import { analyticsApi, workflowApi, unwrapList } from '@/api'
import { useNotifications } from '@/context/NotificationContext'
import type { BadgeKey } from '@/data/menuItems'

const REFRESH_MS = 60_000

/**
 * Live counts for the sidebar badges. The inbox comes from the notification
 * context; tasks and the disposal queue are fetched and refreshed every minute
 * (and whenever the tab becomes visible again).
 */
export function useSidebarCounts(): Partial<Record<BadgeKey, number>> {
  const { unreadCount } = useNotifications() ?? { unreadCount: 0 }
  const [tasks, setTasks] = useState(0)
  const [disposal, setDisposal] = useState(0)

  const load = useCallback(() => {
    workflowApi.getMyTasks()
      .then(({ data }) => setTasks(unwrapList(data).length))
      .catch(() => { /* leave the last known count */ })
    analyticsApi.getDashboard()
      .then(({ data }) => setDisposal(data.overdueRecords ?? 0))
      .catch(() => { /* leave the last known count */ })
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { inbox: unreadCount, tasks, disposal }
}
