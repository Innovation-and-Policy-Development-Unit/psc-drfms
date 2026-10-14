import { useCallback, useEffect, useState } from 'react'
import { FileSpreadsheet, FileText, Plus, Presentation, Sparkles, Trash2 } from 'lucide-react'
import { featuresApi, type DocTemplate } from '@/api/features'
import { driveApi, type RecordSeriesItem } from '@/api/drive'
import { aiErrorMessage } from '@/api/ai'
import { CLASSIFICATION_OPTIONS, DOCUMENT_TYPE_OPTIONS } from '@/lib/recordBadges'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const ICONS = { word: FileText, excel: FileSpreadsheet, powerpoint: Presentation } as const
const EXT = { word: '.docx', excel: '.xlsx', powerpoint: '.pptx' } as const
const BLANK = { name: '', description: '', kind: 'word', documentType: 'other', classificationLevel: 'internal', recordSeries: '', titlePattern: '' }

/** Administrators: the templates staff can start new documents from. */
export default function TemplatesAdmin() {
  const [rows, setRows] = useState<DocTemplate[] | null>(null)
  const [series, setSeries] = useState<RecordSeriesItem[]>([])
  const [form, setForm] = useState<typeof BLANK | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(() => {
    featuresApi.templates(true).then(({ data }) => setRows(data.results)).catch((e) => { setRows([]); setError(aiErrorMessage(e)) })
  }, [])
  useEffect(() => { load(); driveApi.activeSeries().then(setSeries).catch(() => setSeries([])) }, [load])

  const run = async (job: () => Promise<unknown>, done = '') => {
    setBusy(true); setError(''); setNotice('')
    try { await job(); if (done) setNotice(done); load() } catch (e) { setError(aiErrorMessage(e)) } finally { setBusy(false) }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const body = new FormData()
    body.append('name', form.name); body.append('description', form.description); body.append('kind', form.kind)
    body.append('document_type', form.documentType); body.append('classification_level', form.classificationLevel)
    body.append('record_series', form.recordSeries); body.append('title_pattern', form.titlePattern)
    if (file) body.append('file', file)
    void run(async () => { await featuresApi.createTemplate(body); setForm(null); setFile(null) }, 'Template added.')
  }

  return (
    <PageShell
      title="Document templates"
      subtitle="Starting points for new documents: a file plus the type, classification and folder to set. Staff use them from New → From template."
      action={<Button size="sm" onClick={() => { setForm({ ...BLANK }); setFile(null) }}><Plus size={14} /> New template</Button>}
    >
      <div className="space-y-4 p-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

        {form && (
          <Panel className="p-5">
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium" htmlFor="t-name">Name</label>
                <input id="t-name" required maxLength={150} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" /></div>
              <div className="sm:col-span-2"><label className="mb-1 block text-sm font-medium" htmlFor="t-desc">Description</label>
                <input id="t-desc" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input w-full" /></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="t-kind">Kind of file</label>
                <select id="t-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="input w-full">
                  <option value="word">Word document</option><option value="excel">Excel workbook</option><option value="powerpoint">PowerPoint presentation</option>
                </select></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="t-file">File ({EXT[form.kind as keyof typeof EXT]})</label>
                <input id="t-file" type="file" accept={EXT[form.kind as keyof typeof EXT]} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input w-full" />
                <p className="mt-1 text-xs text-muted">Leave empty to start from a blank file.</p></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="t-type">Document type</label>
                <select id="t-type" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} className="input w-full">
                  {DOCUMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="t-class">Classification</label>
                <select id="t-class" value={form.classificationLevel} onChange={(e) => setForm({ ...form, classificationLevel: e.target.value })} className="input w-full">
                  {CLASSIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="t-series">File under</label>
                <select id="t-series" value={form.recordSeries} onChange={(e) => setForm({ ...form, recordSeries: e.target.value })} className="input w-full">
                  <option value="">No folder (the one being browsed is used)</option>
                  {series.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select></div>
              <div><label className="mb-1 block text-sm font-medium" htmlFor="t-title">Title pattern</label>
                <input id="t-title" maxLength={200} placeholder="Minutes - {date}" value={form.titlePattern} onChange={(e) => setForm({ ...form, titlePattern: e.target.value })} className="input w-full" />
                <p className="mt-1 text-xs text-muted">{'{date}'} and {'{year}'} are filled in when the document is created.</p></div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
                <Button type="submit" disabled={busy || !form.name.trim()}>{busy ? 'Saving…' : 'Add template'}</Button>
              </div>
            </form>
          </Panel>
        )}

        <Panel className="overflow-x-auto p-0">
          {rows === null ? <div className="p-6"><Skeleton lines={4} /></div> : rows.length === 0 ? (
            <EmptyState title="No templates yet" description="Add the three starter templates (letter, minutes, Commission submission), or create your own." />
          ) : (
            <table className="registry-table">
              <thead><tr><th>Name</th><th>Type</th><th>Classification</th><th>Files under</th><th>Title pattern</th><th>Active</th><th /></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const Icon = ICONS[t.kind]
                  return (
                    <tr key={t.id}>
                      <td><div className="flex items-center gap-2"><Icon size={16} className="shrink-0 text-muted" /><div className="min-w-0"><p className="truncate text-sm font-medium">{t.name}</p>{t.description && <p className="truncate text-xs text-muted">{t.description}</p>}</div></div></td>
                      <td className="text-xs capitalize">{t.documentType.replace(/_/g, ' ')}</td>
                      <td className="text-xs capitalize">{t.classificationLevel}</td>
                      <td className="text-xs">{t.recordSeriesName || '—'}</td>
                      <td className="font-mono-ref text-xs">{t.titlePattern || '—'}</td>
                      <td><input type="checkbox" className="rounded-sm" checked={t.isActive} disabled={busy} aria-label={`${t.name} is active`} onChange={(e) => run(() => featuresApi.updateTemplate(t.id, { isActive: e.target.checked }))} /></td>
                      <td className="text-end"><button type="button" aria-label={`Delete ${t.name}`} disabled={busy} onClick={() => { if (window.confirm(`Delete the template “${t.name}”? Documents already made from it are not affected.`)) void run(() => featuresApi.deleteTemplate(t.id), 'Template deleted.') }} className="rounded p-1.5 text-gray-400 hover:bg-[var(--surface-sunken)] hover:text-red-600"><Trash2 size={15} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(async () => {
          const { data } = await featuresApi.addStarterTemplates()
          setNotice(data.added.length ? `Added: ${data.added.join(', ')}.` : 'The starter templates are already there.')
        })}><Sparkles size={14} /> Add starter templates</Button>
      </div>
    </PageShell>
  )
}
