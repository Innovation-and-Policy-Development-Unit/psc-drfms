import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { authApi, unwrapList } from '@/api'
import type { User } from '@/types/api'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const ROLES = ['administrator', 'commissioner', 'director', 'records_officer', 'reviewer', 'read_only']

interface NewUserForm {
  email: string
  username: string
  first_name: string
  last_name: string
  password: string
  role: string
}

const EMPTY_FORM: NewUserForm = {
  email: '', username: '', first_name: '', last_name: '', password: '', role: 'read_only',
}

export default function UserManagement() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmSuspendId, setConfirmSuspendId] = useState<number | null>(null)
  const [resetUserId, setResetUserId] = useState<number | null>(null)
  const [resetPassword, setResetPassword] = useState('')

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

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 4000)
  }

  const toggleActive = async (user: User) => {
    if (user.isActive) {
      if (confirmSuspendId !== user.id) {
        setConfirmSuspendId(user.id)
        setTimeout(() => setConfirmSuspendId((id) => (id === user.id ? null : id)), 4000)
        return
      }
      setConfirmSuspendId(null)
      await authApi.suspendUser(user.id)
    } else {
      await authApi.reactivateUser(user.id)
    }
    load()
  }

  const changeRole = async (user: User, role: string) => {
    await authApi.updateUser(user.id, { role })
    flash(t('admin.role_updated'))
    load()
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    try {
      await authApi.createUser({ ...form, username: form.username || form.email.split('@')[0] })
      setForm(EMPTY_FORM)
      setShowCreate(false)
      flash(t('admin.user_created'))
      load()
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data
      setFormError(
        data ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' — ') : 'Error',
      )
    }
  }

  const doResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (resetUserId == null) return
    await authApi.resetUserPassword(resetUserId, resetPassword)
    setResetUserId(null)
    setResetPassword('')
    flash(t('admin.password_reset_done'))
  }

  return (
    <PageShell
      title={t('admin.title')}
      subtitle={t('admin.subtitle')}
      action={
        <Button onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? t('common.cancel') : t('admin.new_user')}
        </Button>
      }
    >
      {notice && <div className="alert-success mb-4">{notice}</div>}

      {showCreate && (
        <Panel className="mb-4">
          <form onSubmit={createUser} className="grid sm:grid-cols-2 gap-4">
            <Input label={t('admin.email')} type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary" htmlFor="new-user-role">{t('admin.role')}</label>
              <select id="new-user-role" className="input w-full capitalize" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <Input label={t('admin.first_name')} required value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Input label={t('admin.last_name')} required value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <Input label={t('admin.temp_password')} type="password" required minLength={10} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              hint="Min. 10 characters" />
            <div className="flex items-end">
              <Button type="submit">{t('admin.create_user')}</Button>
            </div>
            {formError && <p className="sm:col-span-2 text-sm text-[var(--status-danger-fg)]">{formError}</p>}
          </form>
        </Panel>
      )}

      {resetUserId != null && (
        <Panel className="mb-4">
          <form onSubmit={doResetPassword} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-56">
              <Input label={`${t('admin.reset_password')} — ${users.find((u) => u.id === resetUserId)?.email ?? ''}`}
                type="password" required minLength={10} value={resetPassword} autoFocus
                onChange={(e) => setResetPassword(e.target.value)} hint="Min. 10 characters" />
            </div>
            <Button type="submit">{t('common.save')}</Button>
            <Button variant="ghost" type="button" onClick={() => { setResetUserId(null); setResetPassword('') }}>
              {t('common.cancel')}
            </Button>
          </form>
        </Panel>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {['', ...ROLES].map((r) => (
          <button
            key={r || 'all'}
            type="button"
            onClick={() => setRoleFilter(r)}
            className={`btn-sm px-3 py-1.5 border text-sm capitalize ${
              roleFilter === r ? 'border-[var(--brand-navy)] bg-[var(--surface-sunken)]' : 'border-registry text-secondary'
            }`}
          >
            {r ? r.replace(/_/g, ' ') : t('admin.all_roles')}
          </button>
        ))}
      </div>

      <Panel className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6"><Skeleton lines={6} /></div>
        ) : users.length === 0 ? (
          <EmptyState title={t('admin.no_users')} />
        ) : (
          <table className="registry-table">
            <thead>
              <tr>
                <th>{t('admin.name')}</th>
                <th>{t('admin.email')}</th>
                <th>{t('admin.role')}</th>
                <th>{t('admin.twofa')}</th>
                <th>{t('admin.status')}</th>
                <th>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="text-[var(--text-primary)]">{u.firstName} {u.lastName}</td>
                  <td className="font-mono-ref text-xs">{u.email}</td>
                  <td>
                    <select
                      className="input py-1 text-xs capitalize"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      aria-label={t('admin.change_role')}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                  <td>{u.is2faRequired ? <Badge tone="success">{t('admin.required')}</Badge> : <span className="text-muted text-xs">{t('admin.optional')}</span>}</td>
                  <td>
                    <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? t('admin.active') : t('admin.suspended')}</Badge>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant={u.isActive ? 'ghost' : 'secondary'} onClick={() => toggleActive(u)}>
                        {u.isActive
                          ? (confirmSuspendId === u.id ? t('common.confirm') : t('admin.suspend'))
                          : t('admin.reactivate')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setResetUserId(u.id); setResetPassword('') }}>
                        {t('admin.reset_password')}
                      </Button>
                    </div>
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
