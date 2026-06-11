import { useEffect, useState } from 'react'

export interface PresenceViewer {
  userId: number
  name: string
  role: string
  lastSeenAt: string
}

/** Live viewer list for a record via the presence WebSocket (30s heartbeat). */
export function usePresence(recordId: string | undefined): PresenceViewer[] {
  const [viewers, setViewers] = useState<PresenceViewer[]>([])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token || !recordId) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    let ws: WebSocket | null = null
    let heartbeat: number | undefined
    let reconnect: number | undefined
    let disposed = false

    const connect = () => {
      ws = new WebSocket(`${protocol}://${window.location.host}/ws/records/${recordId}/presence/?token=${token}`)
      ws.onopen = () => {
        heartbeat = window.setInterval(() => {
          ws?.send(JSON.stringify({ type: 'heartbeat' }))
        }, 30000)
      }
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as { type: string; viewers?: PresenceViewer[] }
        if (msg.type === 'presence' && msg.viewers) setViewers(msg.viewers)
      }
      ws.onclose = () => {
        if (heartbeat) window.clearInterval(heartbeat)
        if (!disposed) reconnect = window.setTimeout(connect, 5000)
      }
    }
    connect()

    return () => {
      disposed = true
      if (heartbeat) window.clearInterval(heartbeat)
      if (reconnect) window.clearTimeout(reconnect)
      ws?.close()
      setViewers([])
    }
  }, [recordId])

  return viewers
}
