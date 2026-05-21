import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { sharingApi } from '../../api'
import { getFileTypeInfo } from '../../utils/fileType'
import Logo from '../../components/shared/Logo'
import { FileText, Download, AlertCircle } from 'lucide-react'

export default function SharedDocument() {
  const { token } = useParams()
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sharingApi.viewShared(token)
      .then(({ data }) => setRecord(data))
      .catch(err => setError(err.response?.data?.detail || 'This link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  const version = record?.latest_version

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="h-14 flex items-center gap-3 px-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <Logo size={32} />
        <span className="font-semibold text-slate-800 dark:text-white">PSC Shared Document</span>
        <Link to="/auth/login" className="ms-auto text-sm text-primary-600 hover:underline">
          Sign in to PSC Documents
        </Link>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        {loading ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 flex gap-3 text-red-700">
            <AlertCircle className="shrink-0" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 space-y-4">
            <div className="flex items-start gap-4">
              <FileText className="text-primary-600 shrink-0" size={32} />
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{record.title}</h1>
                <p className="text-sm text-slate-500 font-mono mt-1">{record.reference_number}</p>
                {record.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{record.description}</p>
                )}
              </div>
            </div>
            {version && (
              <div className="text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-4">
                <p>File: {version.file_name}</p>
                <p>Type: {getFileTypeInfo(version.mime_type, version.file_name).label}</p>
              </div>
            )}
            {record.allow_download && version?.file_url && (
              <a
                href={version.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 btn-primary"
              >
                <Download size={16} /> Download
              </a>
            )}
            {!record.allow_download && (
              <p className="text-xs text-slate-500">Download is disabled for this share link. View metadata only.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
