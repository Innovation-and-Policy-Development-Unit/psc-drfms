import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { featuresApi, type CustomFieldDef, type MetadataProfilesResponse } from '@/api/features'
import { resetMetadataProfilesCache } from '@/components/record/MetadataCard'
import { aiErrorMessage } from '@/api/ai'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

const slug = (label: string) => {
  const s = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 38)
  return /^[a-z]/.test(s) ? s : `f_${s}`
}

/** Administrators: what each kind of document must have filled in, and any extra fields it carries. */
export default function MetadataAdmin() {
  const [data, setData] = useState<MetadataProfilesResponse | null>(null)
  const [type, setType] = useState('contract')
  const [required, setRequired] = useState<string[]>([])
  const [custom, setCustom] = useState<CustomFieldDef[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    featuresApi.metadataProfiles().then(({ data: d }) => setData(d)).catch((e) => setError(aiErrorMessage(e)))
  }, [])

  useEffect(() => {
    const p = data?.profiles[type]
    setRequired(p?.requiredFields ?? [])
    setCustom(p?.customFields ?? [])
    setNotice('')
  }, [data, type])

  const toggle = (key: string) => setRequired((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  const setField = (i: number, patch: Partial<CustomFieldDef>) => setCustom((cur) => cur.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  const save = async () => {
    setBusy(true); setError(''); setNotice('')
    try {
      const fields = custom.map((f) => ({ ...f, key: f.key || slug(f.label) }))
      const { data: saved } = await featuresApi.saveMetadataProfile(type, { requiredFields: required, customFields: fields })
      setData((d) => (d ? { ...d, profiles: { ...d.profiles, [type]: saved } } : d))
      resetMetadataProfilesCache()
      setNotice('Saved. Records of this type now follow these rules.')
    } catch (e) { setError(aiErrorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <PageShell
      title="Metadata rules"
      subtitle="Choose which details each kind of document must have. A record cannot start a workflow until its required details are filled in, and the record page marks what is missing. You can also add extra fields, such as a contract value."
    >
      <div className="space-y-4 p-4">
        {!data ? <Skeleton lines={5} /> : (
          <Panel className="space-y-6 p-5">
            <div className="max-w-xs">
              <label className="mb-1 block text-sm font-medium" htmlFor="md-type">Document type</label>
              <select id="md-type" value={type} onChange={(e) => setType(e.target.value)} className="input w-full">
                {data.documentTypes.map((t) => <option key={t.value} value={t.value}>{t.label}{data.profiles[t.value] ? ' •' : ''}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">A dot marks types that already have rules.</p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Must be filled in</legend>
              <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {data.coreFields.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm"><input type="checkbox" className="rounded-sm" checked={required.includes(f.key)} onChange={() => toggle(f.key)} /> {f.label}</label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Extra fields for this type</h3>
                <Button size="sm" variant="secondary" disabled={custom.length >= 12} onClick={() => setCustom((c) => [...c, { key: '', label: '', kind: 'text', required: false }])}><Plus size={14} /> Add field</Button>
              </div>
              {custom.length === 0 ? <p className="text-sm text-muted">None. Add fields such as “Contract value” or “Counterparty”.</p> : (
                <ul className="space-y-2">
                  {custom.map((f, i) => (
                    <li key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_130px_auto_auto]">
                      <input value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Field name, e.g. Contract value" aria-label="Field name" maxLength={60} className="input" />
                      <select value={f.kind} onChange={(e) => setField(i, { kind: e.target.value as CustomFieldDef['kind'] })} aria-label="Kind of value" className="input"><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option></select>
                      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="rounded-sm" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} /> Required</label>
                      <button type="button" aria-label="Remove field" onClick={() => setCustom((c) => c.filter((_, j) => j !== i))} className="rounded p-1.5 text-gray-400 hover:bg-[var(--surface-sunken)] hover:text-red-600"><Trash2 size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
            <div><Button onClick={save} disabled={busy || custom.some((f) => !f.label.trim())}>{busy ? 'Saving…' : 'Save rules for this type'}</Button></div>
          </Panel>
        )}
      </div>
    </PageShell>
  )
}
