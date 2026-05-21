import { useState, useEffect } from 'react'
import { sharingApi } from '../../api'
import DriveBreadcrumbs from '../../components/drive/DriveBreadcrumbs'
import { Link2, Copy, Ban } from 'lucide-react'

export default function SharedLinks() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sharingApi.getLinks()
      .then(({ data }) => setLinks(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`)
  }

  const revoke = async (token) => {
    await sharingApi.revokeLink(token)
    setLinks(links.map(l => l.token === token ? { ...l, is_active: false } : l))
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <DriveBreadcrumbs items={[{ label: 'Shared links' }]} />
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Links you&apos;ve shared</h1>
      <p className="text-sm text-slate-500">Manage external share links created from document pages.</p>

      {loading ? (
        <div className="skeleton h-40 rounded-xl" />
      ) : links.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-12 text-center">
          <Link2 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600">No share links yet. Open a document and use the Share tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map(link => (
            <div key={link.id} className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <Link2 className="text-primary-600 shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{link.record_title}</p>
                <p className="text-xs text-slate-500 font-mono truncate">{link.token}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {link.access_count} views · {link.is_active ? 'Active' : 'Revoked'}
                </p>
              </div>
              {link.is_active && (
                <>
                  <button type="button" onClick={() => copyLink(link.token)} className="btn-sm btn-ghost">
                    <Copy size={14} /> Copy
                  </button>
                  <button type="button" onClick={() => revoke(link.token)} className="btn-sm btn-ghost text-red-500">
                    <Ban size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
