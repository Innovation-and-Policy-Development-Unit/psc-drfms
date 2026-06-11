import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, AlertTriangle } from 'lucide-react'
import { recordsApi } from '@/api'
import type { LifecycleStation, RecordLifecycle } from '@/api/records'

function StationDot({ status }: { status: LifecycleStation['status'] }) {
  if (status === 'complete') {
    return (
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 z-1"
        style={{ background: 'var(--status-success-fg)' }}>
        <Check size={13} strokeWidth={3} />
      </span>
    )
  }
  if (status === 'current') {
    return (
      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-1 ring-4"
        style={{ background: 'var(--brand-primary)', ['--tw-ring-color' as string]: 'rgba(70, 95, 255, 0.18)' }}>
        <span className="w-2 h-2 rounded-full bg-white" />
      </span>
    )
  }
  if (status === 'blocked') {
    return (
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0 z-1"
        style={{ background: 'var(--status-danger-fg)' }}>
        <AlertTriangle size={12} strokeWidth={2.5} />
      </span>
    )
  }
  return (
    <span className="w-6 h-6 rounded-full shrink-0 z-1 border-2"
      style={{ background: 'var(--surface-raised)', borderColor: 'var(--border-strong)' }} />
  )
}

export default function LifecycleMap({ recordId, refreshKey = 0 }: { recordId: string; refreshKey?: number }) {
  const [lifecycle, setLifecycle] = useState<RecordLifecycle | null>(null)

  useEffect(() => {
    recordsApi.getLifecycle(recordId)
      .then(({ data }) => setLifecycle(data))
      .catch(() => setLifecycle(null))
  }, [recordId, refreshKey])

  if (!lifecycle) return null

  const stations = lifecycle.stations
  return (
    <div className="px-4 py-3 border-b border-registry overflow-x-auto custom-scrollbar">
      <ol className="flex items-start min-w-[560px]">
        {stations.map((s, i) => (
          <li key={s.key} className="flex-1 flex flex-col items-stretch min-w-0">
            <div className="flex items-center">
              {/* leading connector */}
              <span
                className="h-0.5 flex-1"
                style={{
                  background: i === 0 ? 'transparent'
                    : stations[i - 1].status === 'complete' ? 'var(--status-success-fg)'
                    : 'var(--border-strong)',
                }}
              />
              <StationDot status={s.status} />
              {/* trailing connector */}
              <span
                className="h-0.5 flex-1"
                style={{
                  background: i === stations.length - 1 ? 'transparent'
                    : s.status === 'complete' ? 'var(--status-success-fg)'
                    : 'var(--border-strong)',
                }}
              />
            </div>
            <div className="text-center mt-1.5 px-1">
              <p className={clsx(
                'text-xs font-medium leading-tight',
                s.status === 'pending' ? 'text-muted' : 'text-[var(--text-primary)]',
                s.status === 'blocked' && '!text-[var(--status-danger-fg)]',
              )}>
                {s.label}
              </p>
              {s.detail && (
                <p className="text-[10px] text-muted leading-tight mt-0.5 truncate" title={s.detail}>
                  {s.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
