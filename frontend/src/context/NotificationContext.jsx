import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const wsRef = useRef(null)

  const connectWS = useCallback(() => {
    const token = localStorage.getItem('access_token')
    if (!token || !isAuthenticated) return

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/notifications/?token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'unread_count') {
        setUnreadCount(msg.count)
      } else if (msg.type === 'notification') {
        setNotifications(prev => [msg.data, ...prev])
        setUnreadCount(prev => prev + 1)
      }
    }

    ws.onclose = () => {
      setTimeout(connectWS, 3000)
    }

    wsRef.current = ws
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      connectWS()
    }
    return () => {
      wsRef.current?.close()
    }
  }, [isAuthenticated, connectWS])

  const markRead = useCallback((id) => {
    wsRef.current?.send(JSON.stringify({ type: 'mark_read', id }))
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
