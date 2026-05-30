import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { workflowApi, recordsApi, unwrapList } from '@/api'
import type { RecordListItem } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

interface WorkflowTemplate {
  id: string
  name: string
}

export default function NewSubmission() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [records, setRecords] = useState<RecordListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    template: '',
    title: '',
    record: '',
    notes: '',
  })

  useEffect(() => {
    Promise.all([
      workflowApi.getTemplates().then(({ data }) => setTemplates(unwrapList(data))),
      recordsApi.getRecords({ page_size: 100 }).then(({ data }) => setRecords(unwrapList(data))),
    ]).catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.template || !form.title) return
    setSubmitting(true)
    setError('')
    try {
      const payload: Record<string, string> = {
        template: form.template,
        title: form.title,
      }
      if (form.record) payload.record = form.record
      if (form.notes) payload.notes = form.notes
      const { data } = await workflowApi.createInstance(payload)
      navigate(`/workflows/${data.id}`)
    } catch (err) {
      if (isAxiosError(err)) {
        const detail = err.response?.data?.detail
        setError(typeof detail === 'string' ? detail : 'Failed to start submission.')
      } else {
        setError('Failed to start submission.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PageShell title="New submission" subtitle="Start a PSSM approval workflow.">
        <Skeleton className="h-64" />
      </PageShell>
    )
  }

  return (
    <PageShell
      title="New submission"
      subtitle="Start a PSSM approval workflow."
      action={
        <Link to="/submissions" className="btn-ghost btn-sm">Back to list</Link>
      }
    >
      {error && <div className="alert-danger text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <Panel className="space-y-4">
          <div>
            <label className="label-overline block mb-2">Workflow template</label>
            <select
              value={form.template}
              onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
              required
              className="input"
            >
              <option value="">Select a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-muted mt-2">No templates configured. Contact an administrator.</p>
            )}
          </div>

          <Input
            label="Submission title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder="e.g. Promotion of John Smith — Grade 8"
          />

          <div>
            <label className="label-overline block mb-2">Linked record (optional)</label>
            <select
              value={form.record}
              onChange={(e) => setForm((f) => ({ ...f, record: e.target.value }))}
              className="input"
            >
              <option value="">No linked record</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.referenceNumber} — {r.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-overline block mb-2">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4}
              className="input resize-none"
              placeholder="Background or context for reviewers…"
            />
          </div>
        </Panel>

        <div className="flex justify-end gap-3">
          <Link to="/submissions" className="btn-secondary">Cancel</Link>
          <Button type="submit" disabled={submitting || !form.template || !form.title}>
            {submitting ? 'Starting…' : 'Start submission'}
          </Button>
        </div>
      </form>
    </PageShell>
  )
}
