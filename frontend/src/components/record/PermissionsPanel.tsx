import { useState, useEffect } from 'react'
import { recordsApi } from '../../api'
import { authApi } from '../../api'
import { Shield, Trash2, Plus } from 'lucide-react'

export default function PermissionsPanel({ recordId }) {
  const [perms, setPerms] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')

  const load = () => {
    Promise.all([
      recordsApi.getRecordPermissions(recordId),
      authApi.getUsers({ page_size: '100' }),
    ])
      .then(([p, u]) => {
        setPerms(p.data.results || p.data)
        setUsers(u.data.results || u.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [recordId])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!userId) return
    await recordsApi.setRecordPermission(recordId, {
      user: userId,
      can_view: true,
      can_edit: false,
      can_download: true,
      can_share: false,
    })
    setUserId('')
    load()
  }

  const handleDelete = async (permId) => {
    await recordsApi.deleteRecordPermission(recordId, permId)
    load()
  }

  if (loading) return <div className="p-4 skeleton h-32 rounded-lg" />

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={18} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Document access</h3>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <select className="input flex-1 text-sm" value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">Add user…</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
        <button type="submit" className="btn-sm btn-primary"><Plus size={14} /></button>
      </form>

      {perms.length === 0 ? (
        <p className="text-sm text-slate-500">No custom permissions — role defaults apply.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="py-2">User</th>
                <th>View</th>
                <th>Edit</th>
                <th>Download</th>
                <th>Share</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {perms.map(p => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-2">{p.user_name || p.user_email || `User #${p.user}`}</td>
                  <td>{p.can_view ? 'Yes' : '—'}</td>
                  <td>{p.can_edit ? 'Yes' : '—'}</td>
                  <td>{p.can_download ? 'Yes' : '—'}</td>
                  <td>{p.can_share ? 'Yes' : '—'}</td>
                  <td>
                    <button type="button" onClick={() => handleDelete(p.id)} className="text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
