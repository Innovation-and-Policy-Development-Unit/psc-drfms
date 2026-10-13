import { useMemo, useState } from 'react'
import { Sparkles, Check, ShieldCheck, Cloud, AlertTriangle, ClipboardCheck } from 'lucide-react'
import clsx from 'clsx'
import { updateRecord } from '@/api/records'
import { aiApi, aiErrorMessage } from '@/api/ai'
import { engineLabel } from '@/hooks/useAiStatus'
import type { AiSuggestion, RecordDetail, SensitiveFlag } from '@/types/api'
import { DOC_TYPE_LABELS } from '@/lib/recordBadges'

interface Field {
  key: string
  label: string
  /** PATCH body key; undefined = informational only */
  apply?: string
  /** Applied through the retention endpoint instead of a plain PATCH (a person accepts the schedule) */
  retention?: boolean
  current: (r: RecordDetail) => string | undefined | null
  show?: (v: unknown, s: AiSuggestion) => string
}

const formatAmounts = (v: unknown) =>
  (v as Array<{ label: string; amount: number; currency: string }>)
    .map((a) => `${a.label ? `${a.label}: ` : ''}${a.currency} ${a.amount.toLocaleString()}`.trim())
    .join('; ')

const FIELDS: Field[] = [
  { key: 'documentType', label: 'Document type', apply: 'documentType', current: (r) => r.documentType, show: (v) => DOC_TYPE_LABELS[v as string] ?? (v as string) },
  { key: 'originatingMinistry', label: 'Ministry', apply: 'originatingMinistry', current: (r) => r.originatingMinistry },
  { key: 'documentDate', label: 'Document date', apply: 'documentDate', current: (r) => r.documentDate },
  { key: 'classificationLevel', label: 'Classification', apply: 'classificationLevel', current: (r) => r.classificationLevel },
  {
    key: 'recordSeries', label: 'Retention series', apply: 'recordSeries', retention: true,
    current: (r) => (r.recordSeries != null ? String(r.recordSeries) : null),
    show: (_v, s) => `${s.label ?? ''} — keep ${s.retentionYears} years, until ${s.retentionDate}`,
  },
  { key: 'subjectLine', label: 'Subject / title', apply: 'title', current: (r) => r.title },
  { key: 'parties', label: 'Parties named', current: () => null, show: (v) => (v as string[]).join(', ') },
  { key: 'amounts', label: 'Amounts', current: () => null, show: formatAmounts },
  { key: 'language', label: 'Language', current: () => null },
  { key: 'referenceNumberFormat', label: 'Reference found in text', current: () => null },
]

const confidenceTone = (c: number) =>
  c >= 0.7 ? 'bg-emerald-500' : c >= 0.45 ? 'bg-amber-500' : 'bg-gray-400'

interface Props {
  record: RecordDetail
  canEdit: boolean
  onApplied: () => void
}

/**
 * Suggestions come from on-server rules and, when configured, a language model
 * (the footer says which). They are only ever applied by an explicit click.
 */
export default function AiSuggestionsPanel({ record, canEdit, onApplied }: Props) {
  const version = record.latestVersion ?? record.latest_version
  const suggestions = version?.aiSuggestions as Record<string, AiSuggestion> | undefined
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    if (!suggestions) return []
    return FIELDS.flatMap((f) => {
      const s = suggestions[f.key]
      if (!s?.value) return []
      const current = f.current(record)
      const same = !!f.apply && current === s.value
      return [{ f, s, same }]
    })
  }, [suggestions, record])

  const flags = (suggestions?.sensitiveFlags?.value ?? []) as SensitiveFlag[]

  if (!version) return null

  const run = async (key: string, action: () => Promise<unknown>, failure: string) => {
    setBusy(key)
    setError('')
    try {
      await action()
      onApplied()
    } catch (e) {
      setError(aiErrorMessage(e) || failure)
    } finally {
      setBusy(null)
    }
  }

  const apply = (f: Field, value: unknown) => {
    if (!f.apply) return
    const action = f.retention
      ? () => aiApi.applyRetention(record.id, value as string)
      : () => updateRecord(record.id, { [f.apply as string]: value })
    return run(f.key, action, 'Could not apply that suggestion.')
  }

  // Replacing the title or the retention schedule should always be a deliberate, single action
  const bulk = rows.filter((r) => r.f.apply && !r.same && r.f.key !== 'subjectLine' && !r.f.retention)

  const applyAll = () => run('all', () => updateRecord(
    record.id,
    Object.fromEntries(bulk.map((r) => [r.f.apply as string, r.s.value])),
  ), 'Could not apply the suggestions.')

  const review = version.aiReviewStatus
  const engine = version.aiEngine
  const external = !!engine && !engine.startsWith('ollama')

  return (
    <section className="rounded-2xl border border-primary-100 bg-gradient-to-b from-primary-50/70 to-white p-4 dark:border-primary-500/20 dark:from-primary-500/10 dark:to-transparent">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500 text-white"><Sparkles size={14} /></span>
        <h3 className="font-sans text-sm font-semibold text-gray-900 dark:text-white">Suggested metadata</h3>
      </div>

      {review === 'needs_review' && canEdit && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <span className="inline-flex items-center gap-1.5"><ClipboardCheck size={13} /> Needs your review</span>
          <button type="button" disabled={busy !== null}
            onClick={() => run('review', () => aiApi.markReviewed(record.id), 'Could not update.')}
            className="rounded-full border border-amber-300 px-2.5 py-0.5 font-medium hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/40">
            Mark reviewed
          </button>
        </div>
      )}
      {review === 'auto_filed' && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          Some empty fields were filled automatically. Check them against the document.
        </p>
      )}

      {flags.length > 0 && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-200">
            <AlertTriangle size={13} /> Sensitive content detected
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-red-800 dark:text-red-200">
            {flags.map((f) => (
              <li key={f.category}>
                <span className="font-medium">{f.label}</span>
                {f.count ? ` (${f.count})` : ''}
                {f.example && <span className="text-red-700/80 dark:text-red-300/80"> — {f.example}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-red-700/90 dark:text-red-300/90">
            Review before sharing, and consider redacting these details or raising the classification.
          </p>
        </div>
      )}

      {!version.aiProcessed || rows.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          {version.aiProcessed
            ? 'No confident suggestions for this document.'
            : 'Analysing the document text… suggestions appear here once scanning finishes.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map(({ f, s, same }) => {
            const text = f.show ? f.show(s.value, s) : (s.value as string)
            const reason = s.reason
            return (
              <li key={f.key}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{f.label}</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm text-gray-800 dark:text-gray-100">{text}</p>
                  {f.apply && canEdit && (
                    same ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-600"><Check size={13} /> Set</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => apply(f, s.value)}
                        className="shrink-0 rounded-full border border-primary-200 px-2.5 py-0.5 text-xs font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-500/30 dark:text-primary-300"
                      >
                        {busy === f.key ? '…' : f.retention ? 'Accept' : 'Apply'}
                      </button>
                    )
                  )}
                </div>
                {reason && <p className="mt-0.5 text-[11px] text-gray-400">{reason}</p>}
                <div className="mt-1.5 flex items-center gap-2" title={`Confidence ${Math.round(s.confidence * 100)}%`}>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div className={clsx('h-full rounded-full', confidenceTone(s.confidence))} style={{ width: `${Math.round(s.confidence * 100)}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-gray-400">{Math.round(s.confidence * 100)}%</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {canEdit && bulk.length > 1 && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={applyAll}
          className="mt-4 w-full rounded-xl bg-primary-500 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {busy === 'all' ? 'Applying…' : 'Apply all (except title and retention)'}
        </button>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-400">
        {external ? <Cloud size={12} /> : <ShieldCheck size={12} />}
        {engine
          ? `Analysed by ${engineLabel(engine)}.${external ? ' Text of this record was sent to that service.' : ' Text stays on this server.'}`
          : 'Checked by on-server rules. No text leaves the system.'}
      </p>
    </section>
  )
}
