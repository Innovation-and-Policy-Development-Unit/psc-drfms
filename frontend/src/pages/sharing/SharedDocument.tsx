import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { sharingApi } from '@/api'
import { getFileTypeInfo } from '@/utils/fileType'
import Logo from '@/components/shared/Logo'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'

interface SharedVersion {
  fileName?: string
  file_name?: string
  mimeType?: string
  mime_type?: string
  fileUrl?: string
  file_url?: string
}

interface SharedRecord {
  title: string
  referenceNumber?: string
  reference_number?: string
  description?: string
  allowDownload?: boolean
  allow_download?: boolean
  latestVersion?: SharedVersion
  latest_version?: SharedVersion
}

export default function SharedDocument() {
  const { token = '' } = useParams()
  const [record, setRecord] = useState<SharedRecord | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sharingApi.viewShared(token)
      .then(({ data }) => setRecord(data))
      .catch((err) => setError(err.response?.data?.detail || 'This link is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [token])

  const version: SharedVersion | undefined = record?.latestVersion ?? record?.latest_version
  const fileName = version?.fileName ?? version?.file_name
  const mimeType = version?.mimeType ?? version?.mime_type
  const fileUrl = version?.fileUrl ?? version?.file_url
  const allowDownload = record?.allowDownload ?? record?.allow_download
  const ref = record?.referenceNumber ?? record?.reference_number

  return (
    <div className="min-h-screen bg-surface">
      <header className="h-14 flex items-center gap-3 px-6 border-b border-registry bg-raised">
        <Logo size={32} />
        <span className="font-serif font-semibold">PSC shared document</span>
        <Link to="/auth/login" className="ms-auto text-sm text-[var(--brand-navy)] dark:text-[rgb(var(--p-500))] hover:underline">
          Sign in to PSC-DRFMS
        </Link>
      </header>

      <main className="max-w-3xl mx-auto p-6 animate-registry-in">
        {loading ? (
          <Skeleton className="h-48" />
        ) : error ? (
          <div className="alert-danger">{error}</div>
        ) : record ? (
          <Panel className="space-y-4">
            <div>
              <h1 className="font-serif text-xl font-semibold">{record.title}</h1>
              {ref && <p className="text-sm font-mono-ref text-muted mt-1">{ref}</p>}
              {record.description && (
                <p className="text-sm text-secondary mt-3">{record.description}</p>
              )}
            </div>
            {version && (
              <div className="text-sm text-secondary border-t border-registry pt-4 space-y-1">
                <p>File: {fileName}</p>
                <p>Type: {getFileTypeInfo(mimeType, fileName).label}</p>
              </div>
            )}
            {allowDownload && fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <Button>Download</Button>
              </a>
            ) : (
              <p className="text-xs text-muted">Download is disabled for this link.</p>
            )}
          </Panel>
        ) : null}
      </main>
    </div>
  )
}
