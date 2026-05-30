import { useState, useEffect } from 'react'
import { recordsApi } from '../../api'
import { History } from 'lucide-react'

const ACTION_LABELS = {
  view: 'Viewed',
  download: 'Downloaded',
  upload_version: 'Uploaded version',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_required: 'Revision required',
}

export default function ActivityPanel({ recordId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    recordsApi.getRecordAudit(recordId)
      .then(({ data }) => setLogs(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [recordId])

  if (loading) return <div className="p-4 skeleton h-32 rounded-lg" />

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <History size={16} /> Activity on this document
      </h3>
      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {logs.map(log => (
            <li key={log.id} className="flex gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-slate-900 dark:text-white">
                  <span className="font-medium">{log.user_name || log.user_email || 'System'}</span>
                  {' '}{ACTION_LABELS[log.action] || log.action}
                </p>
                <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
