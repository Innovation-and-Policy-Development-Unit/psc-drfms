import { useState, useEffect } from 'react'
import { sharingApi, recordsApi, authApi } from '../../api'
import clsx from 'clsx'
import { X, Link2, Copy, Ban, Users, Plus } from 'lucide-react'

export default function ShareDialog({ open, onClose, recordId, recordTitle }) {
  const [tab, setTab] = useState('link')
  const [links, setLinks] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(null)
  const [linkForm, setLinkForm] = useState({
    recipient_email: '', allow_download: true, expires_at: '', password: '',
  })
  const [peopleForm, setPeopleForm] = useState({
    user: '', can_view: true, can_edit: false, can_download: true, can_share: false,
  })

  useEffect(() => {
    if (!open || !recordId) return
    setLoading(true)
    Promise.all([
      sharingApi.getLinks({ record: recordId }),
      authApi.getUsers({ page_size: '50' }).catch(() => ({ data: { results: [] } })),
    ])
      .then(([linksRes, usersRes]) => {
        setLinks(linksRes.data.results || linksRes.data)
        setUsers(usersRes.data.results || usersRes.data || [])
      })
      .finally(() => setLoading(false))
  }, [open, recordId])

  if (!open) return null

  const loadLinks = () => {
    sharingApi.getLinks({ record: recordId })
      .then(({ data }) => setLinks(data.results || data))
      .catch(console.error)
  }

  const handleCreateLink = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await sharingApi.createLink({
        record: recordId,
        recipient_email: linkForm.recipient_email,
        allow_download: linkForm.allow_download,
        expires_at: linkForm.expires_at || null,
        password: linkForm.password || '',
      })
      setLinkForm({ recipient_email: '', allow_download: true, expires_at: '', password: '' })
      loadLinks()
    } finally {
      setCreating(false)
    }
  }

  const handleGrantAccess = async (e) => {
    e.preventDefault()
    if (!peopleForm.user) return
    setCreating(true)
    try {
      await recordsApi.setRecordPermission(recordId, {
        user: peopleForm.user,
        can_view: peopleForm.can_view,
        can_edit: peopleForm.can_edit,
        can_download: peopleForm.can_download,
        can_share: peopleForm.can_share,
      })
      setPeopleForm({ user: '', can_view: true, can_edit: false, can_download: true, can_share: false })
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Share</h2>
            <p className="text-xs text-slate-500 truncate max-w-[280px]">{recordTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-700 px-5 gap-4">
          {[
            { id: 'link', label: 'Link', icon: Link2 },
            { id: 'people', label: 'People', icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-1.5 py-3 text-sm font-medium border-b-2 -mb-px',
                tab === id ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          {loading ? (
            <div className="skeleton h-32 rounded-lg" />
          ) : tab === 'link' ? (
            <div className="space-y-4">
              <form onSubmit={handleCreateLink} className="space-y-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <input
                  type="email"
                  className="input text-sm w-full"
                  placeholder="Recipient email (optional)"
                  value={linkForm.recipient_email}
                  onChange={e => setLinkForm(f => ({ ...f, recipient_email: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  className="input text-sm w-full"
                  value={linkForm.expires_at}
                  onChange={e => setLinkForm(f => ({ ...f, expires_at: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={linkForm.allow_download}
                    onChange={e => setLinkForm(f => ({ ...f, allow_download: e.target.checked }))}
                  />
                  Allow download
                </label>
                <button type="submit" disabled={creating} className="btn-primary btn-sm w-full">
                  <Plus size={14} /> {creating ? 'Creating…' : 'Create link'}
                </button>
              </form>
              {links.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No share links yet.</p>
              ) : (
                <ul className="space-y-2">
                  {links.map(link => (
                    <li key={link.id} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                      <Link2 size={16} className="text-primary-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500">{link.access_count} views · {link.is_active ? 'Active' : 'Revoked'}</p>
                      </div>
                      {link.is_active && (
                        <>
                          <button type="button" onClick={() => copyLink(link.token)} className="btn-sm btn-ghost">
                            <Copy size={14} /> {copied === link.token ? 'Copied' : 'Copy'}
                          </button>
                          <button type="button" onClick={() => sharingApi.revokeLink(link.token).then(loadLinks)} className="btn-sm btn-ghost text-red-500">
                            <Ban size={14} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <form onSubmit={handleGrantAccess} className="space-y-3">
              <p className="text-sm text-slate-500">Grant a colleague access to this document.</p>
              <select
                className="input text-sm w-full"
                value={peopleForm.user}
                onChange={e => setPeopleForm(f => ({ ...f, user: e.target.value }))}
                required
              >
                <option value="">Select user…</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {['can_view', 'can_edit', 'can_download', 'can_share'].map(key => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={peopleForm[key]}
                      onChange={e => setPeopleForm(f => ({ ...f, [key]: e.target.checked }))}
                    />
                    {key.replace('can_', '').replace('_', ' ')}
                  </label>
                ))}
              </div>
              <button type="submit" disabled={creating} className="btn-primary btn-sm w-full">
                Grant access
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
