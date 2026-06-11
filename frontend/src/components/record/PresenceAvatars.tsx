import { usePresence } from '@/hooks/usePresence'
import { useAuth } from '@/context/AuthContext'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export default function PresenceAvatars({ recordId }: { recordId: string }) {
  const viewers = usePresence(recordId)
  const { user } = useAuth()
  const others = viewers.filter((v) => v.userId !== user?.id)

  if (others.length === 0) return null

  return (
    <div className="flex items-center gap-1.5" title={others.map((v) => `${v.name} (${v.role})`).join(', ')}>
      <div className="flex -space-x-2">
        {others.slice(0, 4).map((v) => (
          <span
            key={v.userId}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-[var(--surface-raised)]"
            style={{ background: 'var(--brand-accent, var(--brand-primary))' }}
          >
            {initials(v.name)}
          </span>
        ))}
      </div>
      <span className="text-xs text-muted whitespace-nowrap">
        {others.length === 1 ? `${others[0].name.split(' ')[0]} is viewing` : `${others.length} viewing`}
      </span>
    </div>
  )
}
