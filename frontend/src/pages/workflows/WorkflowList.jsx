import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { workflowApi } from '../../api'
import { GitBranch, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

const STATUS_BADGE = {
  pending: 'badge-secondary',
  in_progress: 'badge-info',
  approved: 'badge-success',
  rejected: 'badge-danger',
  revision_required: 'badge-warning',
  cancelled: 'badge-secondary',
}

export default function WorkflowList() {
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    workflowApi.getInstances().then(({ data }) => setInstances(data.results || data)).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workflows</h1>
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Title</th><th>Record</th><th>Step</th><th>Status</th><th>Initiated</th><th></th></tr></thead>
            <tbody>
              {loading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={6}><div className="skeleton h-4 rounded" /></td></tr>)
                : instances.map(inst => (
                <tr key={inst.id}>
                  <td><p className="font-medium text-sm">{inst.title}</p></td>
                  <td><span className="font-mono text-xs">{inst.record_reference}</span></td>
                  <td className="text-sm">Step {inst.current_step}</td>
                  <td><span className={STATUS_BADGE[inst.status] || 'badge-secondary'}>{inst.status.replace('_', ' ')}</span></td>
                  <td className="text-sm text-slate-500">{new Date(inst.initiated_at).toLocaleDateString()}</td>
                  <td><Link to={`/workflows/${inst.id}`} className="btn-sm btn-ghost">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
