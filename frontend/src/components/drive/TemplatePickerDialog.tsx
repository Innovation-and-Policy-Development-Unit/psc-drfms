import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, FileText, LayoutTemplate, Presentation, X } from 'lucide-react'
import clsx from 'clsx'
import { featuresApi, type DocTemplate } from '@/api/features'
import { aiErrorMessage } from '@/api/ai'
import { useAuth } from '@/context/AuthContext'
import { DOC_TYPE_LABELS } from '@/lib/recordBadges'
import { Button } from '@/components/ui/Button'

const ICONS = { word: FileText, excel: FileSpreadsheet, powerpoint: Presentation } as const
const TONES = { word: 'text-blue-600', excel: 'text-emerald-600', powerpoint: 'text-orange-600' } as const

/** The title a template would give today, mirroring the server ({date}, {year}). */
function previewTitle(t: DocTemplate) {
  const now = new Date()
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return (t.titlePattern || t.name).replace('{date}', date).replace('{year}', String(now.getFullYear()))
}

interface Props { recordSeries?: string | null; onClose: () => void }

/** Pick a template, optionally rename, and the new document opens in the editor with its metadata already set. */
export default function TemplatePickerDialog({ recordSeries, onClose }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [templates, setTemplates] = useState<DocTemplate[] | null>(null)
  const [chosen, setChosen] = useState<DocTemplate | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    featuresApi.templates().then(({ data }) => setTemplates(data.results)).catch((e) => { setTemplates([]); setError(aiErrorMessage(e)) })
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chosen) return
    setBusy(true)
    setError('')
    try {
      const { data } = await featuresApi.useTemplate(chosen.id, title.trim(), recordSeries)
      onClose()
      navigate(`/document/${data.id}`)
    } catch (err) { setError(aiErrorMessage(err)); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New from template">
      <form onSubmit={create} className="panel animate-registry-in flex max-h-[85vh] w-full max-w-lg flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><LayoutTemplate size={18} /> New from template</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {templates === null && <p className="text-sm text-muted">Loading…</p>}
          {templates?.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--border-default)] p-6 text-center text-sm text-muted">
              No templates yet.{' '}
              {user?.role === 'administrator' ? <Link to="/admin/templates" onClick={onClose} className="font-medium underline">Add some</Link> : 'Ask an administrator to add some.'}
            </p>
          )}
          {templates?.map((t) => {
            const Icon = ICONS[t.kind]
            const on = chosen?.id === t.id
            return (
              <button key={t.id} type="button" onClick={() => { setChosen(t); setTitle('') }}
                className={clsx('flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors', on ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-500/10' : 'border-[var(--border-default)] hover:bg-[var(--surface-sunken)]')}>
                <Icon size={20} className={clsx('mt-0.5 shrink-0', TONES[t.kind])} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t.name}</span>
                  {t.description && <span className="block text-xs text-muted">{t.description}</span>}
                  <span className="mt-1 block text-[11px] text-muted">{DOC_TYPE_LABELS[t.documentType] ?? t.documentType} · {t.classificationLevel}{t.recordSeriesName ? ` · files under ${t.recordSeriesName}` : ''}</span>
                </span>
              </button>
            )
          })}
        </div>

        {chosen && (
          <div>
            <label htmlFor="tpl-title" className="mb-1 block text-sm font-medium text-secondary">Title</label>
            <input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={previewTitle(chosen)} className="input w-full" />
            <p className="mt-1 text-xs text-muted">Leave empty to use “{previewTitle(chosen)}”.</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!chosen || busy}>{busy ? 'Creating…' : 'Create and open'}</Button>
        </div>
      </form>
    </div>
  )
}
