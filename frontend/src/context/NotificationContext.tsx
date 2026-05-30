import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'

interface NotificationContextValue {
  unreadCount: number
  markRead: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  const connectWS = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token || !isAuthenticated) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/notifications/?token=${token}`)

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as { type: string; count?: number }
      if (msg.type === 'unread_count' && typeof msg.count === 'number') {
        setUnreadCount(msg.count)
      } else if (msg.type === 'notification') {
        setUnreadCount((prev) => prev + 1)
      }
    }

    ws.onclose = () => {
      window.setTimeout(connectWS, 3000)
    }

    wsRef.current = ws
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) connectWS()
    return () => {
      wsRef.current?.close()
    }
  }, [isAuthenticated, connectWS])

  const markRead = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'mark_read', id }))
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  return (
    <NotificationContext.Provider value={{ unreadCount, markRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
