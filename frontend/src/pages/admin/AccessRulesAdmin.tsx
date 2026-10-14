import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { authApi } from '@/api'
import { featuresApi, type PermissionRuleRow } from '@/api/features'
import { driveApi, type RecordSeriesItem } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'
import { CLASSIFICATION_OPTIONS, DOCUMENT_TYPE_OPTIONS } from '@/lib/recordBadges'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface Department { id: number; name: string }
interface Person { id: number; email: string; fullName?: string; full_name?: string }

const LEVELS = [...CLASSIFICATION_OPTIONS, { value: 'secret', label: 'Secret' }]
const BLANK = {
  name: '', who: 'department' as 'department' | 'user', department: '', user: '', recordSeries: '', includeSubseries: true,
  documentType: '', maxClassification: 'confidential', canView: true, canEdit: false, canDownload: true, canShare: false,
}
type Form = typeof BLANK

function rights(r: PermissionRuleRow) {
  return [r.canView && 'view', r.canDownload && 'download', r.canEdit && 'edit', r.canShare && 'share'].filter(Boolean).join(', ')
}

/** Administrators: give a department or person access to every record in a folder or of a type, automatically. */
export default function AccessRulesAdmin() {
  const [rows, setRows] = useState<PermissionRuleRow[] | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [series, setSeries] = useState<RecordSeriesItem[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    featuresApi.rules().then(({ data }) => setRows(data.results)).catch((e) => { setRows([]); setError(aiErrorMessage(e)) })
  }, [])
  useEffect(() => {
    load()
    authApi.getDepartments().then(({ data }) => setDepartments((data.results ?? data) as Department[])).catch(() => setDepartments([]))
    authApi.getUsers({ page_size: '200' }).then(({ data }) => setPeople((data.results ?? data) as Person[])).catch(() => setPeople([]))
    driveApi.activeSeries().then(setSeries).catch(() => setSeries([]))
  }, [load])

  const edit = (r: PermissionRuleRow) => {
    setEditing(r.id)
    setForm({
      name: r.name, who: r.user ? 'user' : 'department', department: r.department ? String(r.department) : '', user: r.user ? String(r.user) : '',
      recordSeries: r.recordSeries ? String(r.recordSeries) : '', includeSubseries: r.includeSubseries, documentType: r.documentType,
      maxClassification: r.maxClassification, canView: r.canView, canEdit: r.canEdit, canDownload: r.canDownload, canShare: r.canShare,
    })
  }

  const run = async (job: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await job(); load() } catch (e) { setError(aiErrorMessage(e)) } finally { setBusy(false) }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const body = {
      name: form.name, department: form.who === 'department' ? form.department || null : null, user: form.who === 'user' ? form.user || null : null,
      recordSeries: form.recordSeries || null, includeSubseries: form.includeSubseries, documentType: form.documentType,
      maxClassification: form.maxClassification, canView: form.canView, canEdit: form.canEdit, canDownload: form.canDownload, canShare: form.canShare,
    }
    void run(async () => {
      if (editing) await featuresApi.updateRule(editing, body); else await featuresApi.createRule(body)
      setForm(null); setEditing(null)
    })
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const personName = (p: Person) => p.fullName ?? p.full_name ?? p.email

  return (
    <PageShell
      title="Access rules"
      subtitle="Automatic permissions: everyone in a department (or one person) gets the rights you choose on every record in a folder or of a document type, now and in future. Rules never reach above the classification you set, and they work alongside the access a record already grants."
      action={<Button size="sm" onClick={() => { setEditing(null); setForm({ ...BLANK }) }}><Plus size={14} /> New rule</Button>}
    >
      <div className="space-y-4 p-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {form && (
          <Panel className="p-5">
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium" htmlFor="r-name">Rule name</label>
                <input id="r-name" required maxLength={150} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="HR staff can read personnel files" className="input w-full" /></div>

              <div><label className="mb-1 block text-sm font-medium" htmlFor="r-who">Who gets access</label>
                <select id="r-who" value={form.who} onChange={(e) => set('who', e.target.value as Form['who'])} className="input w-full"><option value="department">A department</option><option value="user">One person</option></select></div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="r-target">{form.who === 'department' ? 'Department' : 'Person'}</label>
                {form.who === 'department' ? (
                  <select id="r-target" required value={form.department} onChange={(e) => set('department', e.target.value)} className="input w-full"><option value="">Choose…</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
                ) : (
                  <select id="r-target" required value={form.user} onChange={(e) => set('user', e.target.value)} className="input w-full"><option value="">Choose…</option>{people.map((p) => <option key={p.id} value={p.id}>{personName(p)}</option>)}</select>
                )}
              </div>

              <div><label className="mb-1 block text-sm font-medium" htmlFor="r-series">On records in this folder</label>
                <select id="r-series" value={form.recordSeries} onChange={(e) => set('recordSeries', e.target.value)} className="input w-full"><option value="">Any folder</option>{series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
                <label className="mt-1.5 flex items-center gap-2 text-xs text-muted"><input type="checkbox" className="rounded-sm" checked={form.includeSubseries} onChange={(e) => set('includeSubseries', e.target.checked)} /> Include the folders inside it</label></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="r-type">…of this document type</label>
                <select id="r-type" value={form.documentType} onChange={(e) => set('documentType', e.target.value)} className="input w-full"><option value="">Any type</option>{DOCUMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="r-max">Up to classification</label>
                <select id="r-max" value={form.maxClassification} onChange={(e) => set('maxClassification', e.target.value)} className="input w-full">{LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                <p className="mt-1 text-xs text-muted">Records above this level are never covered.</p></div>
              <fieldset><legend className="mb-1 text-sm font-medium">They can</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {([['canView', 'View'], ['canDownload', 'Download'], ['canEdit', 'Edit'], ['canShare', 'Share']] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-1.5"><input type="checkbox" className="rounded-sm" checked={form[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</label>
                  ))}
                </div></fieldset>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => { setForm(null); setEditing(null) }}>Cancel</Button>
                <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save rule' : 'Add rule'}</Button>
              </div>
            </form>
          </Panel>
        )}

        {rows === null ? <Skeleton lines={4} /> : rows.length === 0 ? (
          <Panel className="p-0"><EmptyState title="No access rules" description="Without rules, access comes from the person's role, ownership, and permissions set on each record." /></Panel>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className={`panel flex flex-wrap items-start gap-3 p-4 ${r.isActive ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    <strong className="font-medium text-[var(--text-primary)]">{r.departmentName || r.userName}</strong> can {rights(r)} records
                    {r.recordSeriesName ? ` in ${r.recordSeriesName}${r.includeSubseries ? ' and the folders inside it' : ''}` : ''}
                    {r.documentType ? ` of type ${r.documentType.replace(/_/g, ' ')}` : ''}, up to {r.maxClassification}.
                  </p>
                  <p className="mt-1 text-xs text-muted">Covers {r.matchingRecords} {r.matchingRecords === 1 ? 'record' : 'records'} right now.</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="rounded-sm" checked={r.isActive} disabled={busy} onChange={(e) => run(() => featuresApi.updateRule(r.id, { isActive: e.target.checked }))} /> Active</label>
                <button type="button" aria-label={`Edit ${r.name}`} onClick={() => edit(r)} className="rounded p-1.5 text-gray-500 hover:bg-[var(--surface-sunken)]"><Pencil size={15} /></button>
                <button type="button" aria-label={`Delete ${r.name}`} disabled={busy} onClick={() => { if (window.confirm(`Delete the rule “${r.name}”? People lose the access it gave them straight away.`)) void run(() => featuresApi.deleteRule(r.id)) }} className="rounded p-1.5 text-gray-400 hover:bg-[var(--surface-sunken)] hover:text-red-600"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  )
}
