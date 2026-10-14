import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, Pencil } from 'lucide-react'
import { featuresApi, type MetadataProfilesResponse } from '@/api/features'
import { updateRecord } from '@/api/records'
import { aiErrorMessage } from '@/api/ai'
import { formatDate } from '@/lib/driveFormat'
import type { RecordDetail } from '@/types/api'
import { Button } from '@/components/ui/Button'

let profilesCache: Promise<MetadataProfilesResponse | null> | null = null
/** The per-type field rules, fetched once per page load. */
export function useMetadataProfiles() {
  const [data, setData] = useState<MetadataProfilesResponse | null>(null)
  useEffect(() => {
    profilesCache ??= featuresApi.metadataProfiles().then((r) => r.data).catch(() => null)
    let live = true
    profilesCache.then((d) => { if (live) setData(d) })
    return () => { live = false }
  }, [])
  return data
}
export function resetMetadataProfilesCache() { profilesCache = null }

type CoreKey = 'description' | 'originatingMinistry' | 'documentDate' | 'receivedDate' | 'physicalFileRef' | 'physicalLocation'
const CORE_FORM: Array<{ key: CoreKey; api: string; label: string; kind: 'text' | 'date' | 'area' }> = [
  { key: 'description', api: 'description', label: 'Description', kind: 'area' },
  { key: 'originatingMinistry', api: 'originating_ministry', label: 'Originating ministry', kind: 'text' },
  { key: 'documentDate', api: 'document_date', label: 'Document date', kind: 'date' },
  { key: 'receivedDate', api: 'received_date', label: 'Received date', kind: 'date' },
  { key: 'physicalFileRef', api: 'physical_file_ref', label: 'Physical file reference', kind: 'text' },
  { key: 'physicalLocation', api: 'physical_location', label: 'Physical location', kind: 'text' },
]
// Core fields the rules can name that are edited elsewhere on the page
const ELSEWHERE: Record<string, string> = { record_series: 'Record series (set in the folder or Move)', tags: 'Tags (above)' }

interface Props { record: RecordDetail; canEdit: boolean; onSaved: () => void }

/** All of a record's descriptive fields in one place, with the ones this document type requires marked. */
export default function MetadataCard({ record, canEdit, onSaved }: Props) {
  const profiles = useMetadataProfiles()
  const profile = profiles?.profiles[record.documentType]
  const required = new Set(profile?.requiredFields ?? [])
  const missing = record.metadataMissing ?? []
  const custom = profile?.customFields ?? []
  const values = record.customFields ?? {}

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const initial = useMemo(() => {
    const base: Record<string, string> = {}
    CORE_FORM.forEach((f) => { base[f.key] = String((record as unknown as Record<string, unknown>)[f.key] ?? '') })
    custom.forEach((f) => { base[`c:${f.key}`] = String(values[f.key] ?? '') })
    return base
  }, [record, custom, values])

  const start = () => { setForm(initial); setError(''); setEditing(true) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body: Record<string, unknown> = {}
      CORE_FORM.forEach((f) => {
        if (form[f.key] !== initial[f.key]) body[f.api] = form[f.key] === '' && f.kind === 'date' ? null : form[f.key]
      })
      if (custom.some((f) => form[`c:${f.key}`] !== initial[`c:${f.key}`])) {
        body.custom_fields = { ...values, ...Object.fromEntries(custom.map((f) => [f.key, form[`c:${f.key}`] ?? ''])) }
      }
      if (Object.keys(body).length) await updateRecord(record.id, body)
      setEditing(false)
      onSaved()
    } catch (err) { setError(aiErrorMessage(err)) } finally { setBusy(false) }
  }

  const show = (v: unknown, kind: string) => (v ? (kind === 'date' ? formatDate(String(v)) : String(v)) : '—')
  const star = (key: string) => (required.has(key) ? <span className="text-red-500" title="Required for this document type"> *</span> : null)

  return (
    <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"><ClipboardList size={14} /></span>
        <h3 className="font-sans text-sm font-semibold text-gray-900 dark:text-white">Record details</h3>
        {canEdit && !editing && <button type="button" onClick={start} aria-label="Edit record details" className="ms-auto rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><Pencil size={14} /></button>}
      </div>

      {missing.length > 0 ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Required before a workflow can start: {missing.map((m) => m.label).join(', ')}.</span>
        </p>
      ) : required.size > 0 || custom.some((f) => f.required) ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={13} /> All required details are filled in.</p>
      ) : null}

      {editing ? (
        <form onSubmit={save} className="mt-3 space-y-3">
          {CORE_FORM.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`md-${f.key}`}>{f.label}{star(f.api)}</label>
              {f.kind === 'area'
                ? <textarea id={`md-${f.key}`} rows={3} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="input w-full" />
                : <input id={`md-${f.key}`} type={f.kind} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="input w-full" />}
            </div>
          ))}
          {custom.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`md-c-${f.key}`}>{f.label}{f.required && <span className="text-red-500"> *</span>}</label>
              <input id={`md-c-${f.key}`} type={f.kind} step={f.kind === 'number' ? 'any' : undefined} value={form[`c:${f.key}`] ?? ''} onChange={(e) => setForm({ ...form, [`c:${f.key}`]: e.target.value })} className="input w-full" />
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      ) : (
        <dl className="mt-3 divide-y divide-[var(--border-default)] text-sm">
          {CORE_FORM.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="shrink-0 text-xs text-muted">{f.label}{star(f.api)}</dt>
              <dd className="min-w-0 break-words text-end">{show((record as unknown as Record<string, unknown>)[f.key], f.kind)}</dd>
            </div>
          ))}
          {custom.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="shrink-0 text-xs text-muted">{f.label}{f.required && <span className="text-red-500"> *</span>}</dt>
              <dd className="min-w-0 break-words text-end">{show(values[f.key], f.kind)}</dd>
            </div>
          ))}
          {[...required].filter((k) => ELSEWHERE[k]).map((k) => (
            <div key={k} className="py-1.5 text-xs text-muted">{ELSEWHERE[k]} is also required.</div>
          ))}
        </dl>
      )}
    </section>
  )
}
