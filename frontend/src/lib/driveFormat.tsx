import type { RecordListItem } from '@/types/api'

export function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

/** Retention date as text plus a tone: red once past, amber inside 90 days. */
export function retentionInfo(date?: string | null): { text: string; tone: 'none' | 'ok' | 'soon' | 'past' } {
  if (!date) return { text: '—', tone: 'none' }
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
  const text = new Date(date).toLocaleDateString()
  if (days < 0) return { text, tone: 'past' }
  return { text, tone: days <= 90 ? 'soon' : 'ok' }
}

const TONE_CLASS = {
  none: '',
  ok: 'text-muted',
  soon: 'text-amber-700 dark:text-amber-300 font-medium',
  past: 'text-red-700 dark:text-red-300 font-medium',
} as const

export function RetentionText({ date }: { date?: string | null }) {
  const { text, tone } = retentionInfo(date)
  return <span className={`text-xs whitespace-nowrap ${TONE_CLASS[tone]}`} title={tone === 'past' ? 'Retention period has ended' : undefined}>{text}</span>
}

/** Short status chips: draft, legal hold, vital. */
export function statusLabels(r: Pick<RecordListItem, 'isDraft' | 'isOnLegalHold' | 'isVital'>) {
  return [
    r.isOnLegalHold && { text: 'Legal hold', cls: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
    r.isVital && { text: 'Vital', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    r.isDraft && { text: 'Draft', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300' },
  ].filter(Boolean) as Array<{ text: string; cls: string }>
}
