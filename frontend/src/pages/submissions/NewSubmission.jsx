import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { workflowApi, recordsApi } from '../../api'
import { Send, ChevronRight, AlertCircle } from 'lucide-react'

export default function NewSubmission() {
  const navigate = useNavigate()
  const [templates, setTemplates]   = useState([])
  const [records, setRecords]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const [form, setForm] = useState({
    template: '',
    title: '',
    record: '',
    notes: '',
  })

  useEffect(() => {
    Promise.all([
      workflowApi.getTemplates().then(({ data }) => setTemplates(Array.isArray(data) ? data : (data.results ?? []))),
      recordsApi.getRecords({ page_size: 100 }).then(({ data }) => setRecords(Array.isArray(data) ? data : (data.results ?? []))),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.template || !form.title) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        template: form.template,
        title: form.title,
        ...(form.record ? { record: form.record } : {}),
        ...(form.notes  ? { notes: form.notes }   : {}),
      }
      const { data } = await workflowApi.createInstance(payload)
      navigate(`/workflows/${data.id}`)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to start submission. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/submissions" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
          Submissions
        </Link>
        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
        <span className="text-slate-700 dark:text-slate-300 font-medium">New submission</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
          <Send size={20} className="text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New submission</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Start a PSSM approval workflow</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">

        {/* Workflow template */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Workflow template <span className="text-red-500">*</span>
          </label>
          <select
            value={form.template}
            onChange={set('template')}
            required
            disabled={loading}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">Select a template…</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {templates.length === 0 && !loading && (
            <p className="text-xs text-amber-600 dark:text-amber-400">No workflow templates configured. Ask an administrator to create one.</p>
          )}
        </div>

        {/* Title */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Submission title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            required
            placeholder="e.g. Promotion of John Smith — Grade 8"
            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>

        {/* Linked record (optional) */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Linked record <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            value={form.record}
            onChange={set('record')}
            disabled={loading}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            <option value="">No linked record</option>
            {records.map(r => (
              <option key={r.id} value={r.id}>
                {r.reference_number} — {r.title}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="px-6 py-5 space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={4}
            placeholder="Provide any relevant background or context for reviewers…"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
          <Link to="/submissions" className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !form.template || !form.title}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Send size={15} />
            {submitting ? 'Starting…' : 'Start submission'}
          </button>
        </div>
      </form>
    </div>
  )
}
