import { useState, useEffect } from 'react'
import { workflowApi } from '../../api'
import DriveBreadcrumbs from '../../components/drive/DriveBreadcrumbs'
import { ClipboardList } from 'lucide-react'

export default function WorkflowTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    workflowApi.getTemplates()
      .then(({ data }) => setTemplates(data.results || data))
      .catch(err => setError(err.response?.status === 403 ? 'Administrator access required.' : 'Failed to load templates.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <DriveBreadcrumbs items={[{ label: 'Workflow templates' }]} />
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <ClipboardList size={22} /> Workflow templates
      </h1>
      {error && <p className="text-sm text-amber-600">{error}</p>}
      {loading ? (
        <div className="skeleton h-40 rounded-xl" />
      ) : templates.length === 0 ? (
        <p className="text-slate-500">No templates configured.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map(t => (
            <div key={t.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h3 className="font-medium text-slate-900 dark:text-white">{t.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{t.description || 'No description'}</p>
              <p className="text-xs text-slate-400 mt-2">{t.steps?.length || 0} steps · {t.is_active ? 'Active' : 'Inactive'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
