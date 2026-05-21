import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workflowApi } from '../../api'
import DriveBreadcrumbs from '../../components/drive/DriveBreadcrumbs'
import clsx from 'clsx'
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Loader2, FileText } from 'lucide-react'

const STATUS_STYLE = {
  pending: 'badge-secondary',
  in_progress: 'badge-info',
  approved: 'badge-success',
  rejected: 'badge-danger',
  revision_required: 'badge-warning',
  cancelled: 'badge-secondary',
}

export default function WorkflowDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [instance, setInstance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    workflowApi.getInstance(id)
      .then(({ data }) => setInstance(data))
      .catch(() => setError('Workflow not found.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const pendingAction = instance?.actions?.find(
    a => a.step_number === instance.current_step && a.action === 'pending'
  )

  const handleAction = async (action) => {
    setSubmitting(true)
    setError('')
    try {
      await workflowApi.actionWorkflow(id, { action, comments })
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
  }

  if (error && !instance) {
    return <div className="p-6 text-center"><p>{error}</p></div>
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <DriveBreadcrumbs items={[
        { label: 'Approvals', to: '/workflows/my-tasks' },
        { label: instance.title },
      ]} />

      <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{instance.title}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Record{' '}
              <Link to={`/document/${instance.record}`} className="text-primary-600 hover:underline font-mono">
                {instance.record_reference}
              </Link>
            </p>
          </div>
          <span className={STATUS_STYLE[instance.status] || 'badge-secondary'}>
            {instance.status.replace('_', ' ')}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Current step</dt>
            <dd className="font-medium">{instance.current_step}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Initiated by</dt>
            <dd className="font-medium">{instance.initiated_by_name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Started</dt>
            <dd>{new Date(instance.initiated_at).toLocaleString()}</dd>
          </div>
          {instance.completed_at && (
            <div>
              <dt className="text-slate-500">Completed</dt>
              <dd>{new Date(instance.completed_at).toLocaleString()}</dd>
            </div>
          )}
        </dl>

        {instance.notes && (
          <p className="text-sm text-slate-600 dark:text-slate-400 border-t pt-4">{instance.notes}</p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Approval steps</h2>
        <div className="space-y-3">
          {instance.actions?.map(action => (
            <div
              key={action.id}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-lg border',
                action.action === 'pending' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-700'
              )}
            >
              {action.action === 'approved' && <CheckCircle size={18} className="text-emerald-500" />}
              {action.action === 'rejected' && <XCircle size={18} className="text-red-500" />}
              {action.action === 'pending' && <AlertCircle size={18} className="text-amber-500" />}
              {action.action === 'revision_required' && <AlertCircle size={18} className="text-orange-500" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Step {action.step_number}: {action.step_name}</p>
                <p className="text-xs text-slate-500">
                  {action.assigned_to_name || 'Unassigned'}
                  {action.deadline && ` · due ${new Date(action.deadline).toLocaleDateString()}`}
                </p>
                {action.comments && <p className="text-xs text-slate-600 mt-1 italic">{action.comments}</p>}
              </div>
              <span className="text-xs capitalize text-slate-500">{action.action.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {pendingAction && instance.status === 'in_progress' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-primary-200 dark:border-primary-800 p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 dark:text-white">Your action required</h2>
          <p className="text-sm text-slate-600">You are assigned to: <strong>{pendingAction.step_name}</strong></p>
          {error && <div className="alert-danger text-sm">{error}</div>}
          <textarea
            className="input resize-none text-sm"
            rows={3}
            placeholder="Comments (optional)"
            value={comments}
            onChange={e => setComments(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <button type="button" disabled={submitting} onClick={() => handleAction('approved')} className="btn-primary">
              <CheckCircle size={16} /> Approve
            </button>
            <button type="button" disabled={submitting} onClick={() => handleAction('revision_required')} className="btn-secondary">
              Request revision
            </button>
            <button type="button" disabled={submitting} onClick={() => handleAction('rejected')} className="btn-sm text-red-600 border border-red-200 hover:bg-red-50">
              <XCircle size={16} /> Reject
            </button>
          </div>
        </div>
      )}

      <Link to={`/document/${instance.record}`} className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline">
        <FileText size={16} /> Open document
      </Link>
    </div>
  )
}
