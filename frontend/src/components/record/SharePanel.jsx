import { useState, useEffect } from 'react'
import { sharingApi } from '../../api'
import { Link2, Copy, Ban, Plus } from 'lucide-react'

export default function SharePanel({ recordId, recordTitle }) {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    recipient_email: '',
    allow_download: true,
    expires_at: '',
    password: '',
  })
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(null)

  const load = () => {
    sharingApi.getLinks({ record: recordId })
      .then(({ data }) => setLinks(data.results || data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [recordId])

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await sharingApi.createLink({
        record: recordId,
        recipient_email: form.recipient_email,
        allow_download: form.allow_download,
        expires_at: form.expires_at || null,
        password: form.password || '',
      })
      setShowForm(false)
      setForm({ recipient_email: '', allow_download: true, expires_at: '', password: '' })
      load()
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (token) => {
    const url = `${window.location.origin}/shared/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const revoke = async (token) => {
    await sharingApi.revokeLink(token)
    load()
  }

  if (loading) return <div className="p-4 skeleton h-32 rounded-lg" />

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Shared links</h3>
          <p className="text-xs text-slate-500 mt-0.5">Share “{recordTitle}” with external recipients</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="btn-sm btn-primary">
          <Plus size={14} /> New link
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50">
          <input
            type="email"
            className="input text-sm"
            placeholder="Recipient email (optional)"
            value={form.recipient_email}
            onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))}
          />
          <input
            type="datetime-local"
            className="input text-sm"
            value={form.expires_at}
            onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
          />
          <input
            type="password"
            className="input text-sm"
            placeholder="Link password (optional)"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allow_download} onChange={e => setForm(f => ({ ...f, allow_download: e.target.checked }))} />
            Allow download
          </label>
          <button type="submit" disabled={creating} className="btn-primary btn-sm w-full">
            {creating ? 'Creating…' : 'Create share link'}
          </button>
        </form>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No active share links for this document.</p>
      ) : (
        <div className="space-y-2">
          {links.map(link => (
            <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <Link2 size={18} className="text-primary-600 shrink-0" />
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-mono text-xs truncate">{link.token}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {link.access_count} views
                  {link.expires_at && ` · expires ${new Date(link.expires_at).toLocaleDateString()}`}
                  {!link.is_active && ' · revoked'}
                </p>
              </div>
              {link.is_active && (
                <>
                  <button type="button" onClick={() => copyLink(link.token)} className="btn-sm btn-ghost">
                    <Copy size={14} /> {copied === link.token ? 'Copied' : 'Copy'}
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
