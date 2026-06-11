import { useState, useEffect, useCallback } from 'react'
import { systemApi } from '@/api'
import type { HealthCheck } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await systemApi.getHealth()
      setHealth(data)
      setLastChecked(new Date())
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <PageShell
      title="System health"
      subtitle="Real-time status of database, cache, and background workers."
      action={
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          Refresh
        </Button>
      }
    >
      {loading && !health ? (
        <Panel><Skeleton lines={4} /></Panel>
      ) : (
        <div className="space-y-4">
          <Panel className="flex items-center justify-between">
            <div>
              <p className="label-overline mb-1">Overall status</p>
              <p className="font-serif text-xl font-semibold capitalize">{health?.status ?? 'Unknown'}</p>
            </div>
            <Badge tone={health?.status === 'healthy' ? 'success' : 'warning'}>
              {health?.status ?? 'unreachable'}
            </Badge>
          </Panel>

          <div className="grid sm:grid-cols-3 gap-4">
            {health &&
              Object.entries(health.checks).map(([name, status]) => (
                <Panel key={name}>
                  <p className="label-overline mb-2 capitalize">{name}</p>
                  <p className={`text-sm font-mono-ref ${status === 'ok' ? 'text-[var(--status-success-fg)]' : 'text-[var(--status-danger-fg)]'}`}>
                    {status}
                  </p>
                </Panel>
              ))}
          </div>

          {lastChecked && (
            <p className="text-xs text-muted">Last checked {lastChecked.toLocaleString()}</p>
          )}
        </div>
      )}
    </PageShell>
  )
}
