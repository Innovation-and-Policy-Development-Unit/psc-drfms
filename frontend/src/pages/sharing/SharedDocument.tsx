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
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [unlockedPassword, setUnlockedPassword] = useState('')

  const load = (pw?: string) => {
    setLoading(true)
    sharingApi.viewShared(token, pw)
      .then(({ data }) => {
        setRecord(data)
        setPasswordRequired(false)
        setPasswordError('')
        if (pw) setUnlockedPassword(pw)
      })
      .catch((err) => {
        if (err.response?.status === 401 && err.response?.data?.password_required) {
          setPasswordRequired(true)
          if (pw) setPasswordError('Incorrect password.')
        } else {
          setError(err.response?.data?.detail || 'This link is invalid or has expired.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

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
        ) : passwordRequired ? (
          <Panel className="space-y-4 max-w-md mx-auto">
            <div>
              <h1 className="font-serif text-lg font-semibold">Password required</h1>
              <p className="text-sm text-secondary mt-1">This shared document is protected. Enter the password you were given.</p>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (password) load(password) }}
              className="space-y-3"
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="input w-full"
              />
              {passwordError && <p className="text-sm text-[var(--status-danger-fg)]">{passwordError}</p>}
              <Button type="submit" disabled={!password}>Unlock</Button>
            </form>
          </Panel>
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
              <a
                href={unlockedPassword ? `${fileUrl}?password=${encodeURIComponent(unlockedPassword)}` : fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
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
