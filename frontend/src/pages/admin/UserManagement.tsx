import { useState, useEffect, useCallback } from 'react'
import { authApi, unwrapList } from '@/api'
import type { User } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = roleFilter ? { role: roleFilter } : undefined
      const { data } = await authApi.getUsers(params)
      setUsers(unwrapList(data))
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  useEffect(() => { load() }, [load])

  const toggleActive = async (user: User) => {
    if (user.isActive) {
      if (!confirm(`Suspend ${user.email}?`)) return
      await authApi.suspendUser(user.id)
    } else {
      await authApi.reactivateUser(user.id)
    }
    load()
  }

  return (
    <PageShell
      title="User administration"
      subtitle="Manage accounts, roles, and emergency access revocation."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        {['', 'administrator', 'director', 'records_officer', 'reviewer', 'read_only'].map((r) => (
          <button
            key={r || 'all'}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={`btn-sm px-3 py-1.5 border text-sm capitalize ${
              roleFilter === r ? 'border-[var(--brand-navy)] bg-[var(--surface-sunken)]' : 'border-registry text-secondary'
            }`}
          >
            {r ? r.replace(/_/g, ' ') : 'All roles'}
          </button>
        ))}
      </div>

      <Panel className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>2FA</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="text-[var(--text-primary)]">{u.firstName} {u.lastName}</td>
                  <td className="font-mono-ref text-xs">{u.email}</td>
                  <td className="capitalize text-xs">{u.role.replace(/_/g, ' ')}</td>
                  <td>{u.is2faRequired ? <Badge tone="success">Required</Badge> : <span className="text-muted text-xs">Optional</span>}</td>
                  <td>
                    <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Suspended'}</Badge>
                  </td>
                  <td>
                    <Button size="sm" variant={u.isActive ? 'ghost' : 'secondary'} onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Suspend' : 'Reactivate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </PageShell>
  )
}
