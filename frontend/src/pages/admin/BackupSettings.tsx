import { useCallback, useEffect, useRef, useState } from 'react'
import { backupsApi, type BackupRun, type BackupSettings as Settings, type BackupFrequency } from '@/api/backups'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface Form {
  enabled: boolean
  server: string
  share: string
  folder: string
  domain: string
  username: string
  password: string
  frequency: BackupFrequency
  runHour: number
  weekday: number
  keepDatabaseCopies: number
  encrypt: boolean
  passphrase: string
}

const toForm = (s: Settings): Form => ({
  enabled: s.enabled, server: s.server, share: s.share, folder: s.folder, domain: s.domain,
  username: s.username, password: '', frequency: s.frequency, runHour: s.runHour,
  weekday: s.weekday, keepDatabaseCopies: s.keepDatabaseCopies, encrypt: s.encrypt, passphrase: '',
})

function bytes(n: number) {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

function errorText(err: unknown) {
  const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data
  if (!data) return 'Something went wrong.'
  if (typeof data.message === 'string') return data.message
  if (typeof data.detail === 'string') return data.detail
  return Object.values(data).map((v) => (Array.isArray(v) ? v.join(' ') : String(v))).join(' ')
}

const TONE = { success: 'success', failed: 'danger', running: 'info' } as const
const when = (iso: string) => new Date(iso).toLocaleString()

export default function BackupSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [runs, setRuns] = useState<BackupRun[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'save' | 'test' | 'run' | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const dirtyRef = useRef(false)

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([backupsApi.getSettings(), backupsApi.runs()])
    setSettings(s.data)
    setRuns(r.data)
    if (!dirtyRef.current) setForm(toForm(s.data))
  }, [])

  useEffect(() => { load().catch(() => setNotice({ ok: false, text: 'Could not load backup settings.' })) }, [load])

  // Poll while a backup is running so progress and the result appear without a refresh.
  useEffect(() => {
    if (!settings?.running) return
    const id = window.setInterval(() => { load().catch(() => undefined) }, 4000)
    return () => window.clearInterval(id)
  }, [settings?.running, load])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    dirtyRef.current = true
    setDirty(true)
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    setBusy('save')
    setNotice(null)
    try {
      const { data } = await backupsApi.saveSettings(form)
      dirtyRef.current = false
      setDirty(false)
      setSettings(data)
      setForm(toForm(data))
      setNotice({ ok: true, text: 'Backup settings saved.' })
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    if (!form) return
    setBusy('test')
    setNotice(null)
    try {
      const { data } = await backupsApi.test(form)
      setNotice({ ok: true, text: data.message })
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  const runNow = async () => {
    setBusy('run')
    setNotice(null)
    try {
      await backupsApi.runNow()
      await load()
      setNotice({ ok: true, text: 'Backup started.' })
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) })
    } finally {
      setBusy(null)
    }
  }

  if (!settings || !form) {
    return (
      <PageShell title="Backup" subtitle="Back up DRFMS to a Windows file share.">
        <Panel><Skeleton lines={5} /></Panel>
      </PageShell>
    )
  }

  const select = 'input w-full'
  const canTest = Boolean(form.server.trim() && form.share.trim() && form.username.trim()
    && (form.password || settings.hasPassword))
  const state = settings.enabled && settings.configured ? 'Scheduled' : settings.configured ? 'Switched off' : 'Not set up'

  return (
    <PageShell
      title="Backup"
      subtitle="Back up the database and every stored document to a Windows file share."
      action={
        <Button onClick={runNow} disabled={!settings.configured || settings.running || busy !== null}>
          {settings.running ? 'Backup running…' : 'Back up now'}
        </Button>
      }
    >
      {notice && (
        <div className={`${notice.ok ? 'alert-success' : 'alert-danger'} mb-4`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </div>
      )}
      {settings.credentialsUnreadable && (
        <div className="alert-danger mb-4" role="alert">
          The saved share password or encryption passphrase can no longer be read, which happens when the server&apos;s
          secret key has changed. Enter them again and save before the next backup.
        </div>
      )}
      {settings.overdue && (
        <div className="alert-danger mb-4" role="alert">
          No backup has completed successfully{settings.lastSuccessAt ? ` since ${when(settings.lastSuccessAt)}` : ''}.
          Check the history below, then use &ldquo;Back up now&rdquo;.
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-4 mb-4">
        <Panel>
          <p className="label-overline mb-1">Status</p>
          <Badge tone={settings.enabled && settings.configured ? 'success' : 'neutral'}>{state}</Badge>
        </Panel>
        <Panel>
          <p className="label-overline mb-1">Last attempt</p>
          {settings.lastRun ? (
            <p className="text-sm">
              <Badge tone={TONE[settings.lastRun.status]}>{settings.lastRun.status}</Badge>{' '}
              <span className="text-secondary">{when(settings.lastRun.startedAt)}</span>
            </p>
          ) : <p className="text-sm text-muted">None yet</p>}
        </Panel>
        <Panel>
          <p className="label-overline mb-1">Last success</p>
          <p className="text-sm">{settings.lastSuccessAt ? when(settings.lastSuccessAt) : '—'}</p>
        </Panel>
        <Panel>
          <p className="label-overline mb-1">Next backup</p>
          <p className="text-sm">{settings.nextRun ? when(settings.nextRun) : '—'}</p>
        </Panel>
      </div>

      <Panel className="mb-4">
        <form onSubmit={save} className="space-y-5">
          <fieldset className="space-y-4">
            <legend className="label-overline mb-1">Windows file share</legend>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Server" placeholder="e.g. fileserver.psc.local" value={form.server} maxLength={255}
                onChange={(e) => set('server', e.target.value)} hint="Name or IP address of the Windows file server." />
              <Input label="Share name" placeholder="e.g. backups" value={form.share} maxLength={80}
                onChange={(e) => set('share', e.target.value)} hint="The part after the server in \\server\share." />
              <Input label="Folder on the share" value={form.folder} maxLength={255}
                onChange={(e) => set('folder', e.target.value)} hint="Created if it does not exist." />
              <Input label="Domain (optional)" value={form.domain} maxLength={128}
                onChange={(e) => set('domain', e.target.value)} />
              <Input label="Username" autoComplete="off" value={form.username} maxLength={128}
                onChange={(e) => set('username', e.target.value)}
                hint="Use an account that can only write to this share." />
              <Input label="Password" type="password" autoComplete="new-password" value={form.password}
                placeholder={settings.hasPassword ? '•••••••• (saved)' : ''}
                onChange={(e) => set('password', e.target.value)}
                hint={settings.hasPassword ? 'Leave blank to keep the saved password.' : 'Required.'} />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="label-overline mb-1">Schedule</legend>
            <div className="grid sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-secondary" htmlFor="bk-freq">Frequency</label>
                <select id="bk-freq" className={select} value={form.frequency}
                  onChange={(e) => set('frequency', e.target.value as BackupFrequency)}>
                  <option value="daily">Every day</option>
                  <option value="weekly">Every week</option>
                </select>
              </div>
              {form.frequency === 'weekly' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-secondary" htmlFor="bk-day">Day</label>
                  <select id="bk-day" className={select} value={form.weekday}
                    onChange={(e) => set('weekday', Number(e.target.value))}>
                    {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-secondary" htmlFor="bk-hour">Time</label>
                <select id="bk-hour" className={select} value={form.runHour}
                  onChange={(e) => set('runHour', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
                <p className="text-xs text-muted">Server time ({settings.timezone.replace(/_/g, ' ')})</p>
              </div>
              <Input label="Database copies to keep" type="number" min={1} max={365} value={form.keepDatabaseCopies}
                onChange={(e) => set('keepDatabaseCopies', Number(e.target.value))}
                hint="Older database copies are removed." />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
              Run backups automatically on this schedule
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="label-overline mb-1">Encryption</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.encrypt} onChange={(e) => set('encrypt', e.target.checked)} />
              Encrypt everything written to the share
            </label>
            {form.encrypt && (
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Encryption passphrase" type="password" autoComplete="new-password" minLength={12}
                  value={form.passphrase}
                  placeholder={settings.hasPassphrase ? '•••••••• (saved)' : ''}
                  onChange={(e) => set('passphrase', e.target.value)}
                  hint={settings.hasPassphrase ? 'Leave blank to keep the saved passphrase.' : 'At least 12 characters.'} />
                <div className="alert-danger text-sm self-start" role="note">
                  Keep this passphrase somewhere safe, outside DRFMS. Without it, encrypted backups cannot be read,
                  and nobody can recover it for you. Files already on the share stay as they are; delete older
                  unencrypted copies there yourself.
                </div>
              </div>
            )}
          </fieldset>

          {dirty && <p className="text-xs text-muted">You have unsaved changes. &ldquo;Back up now&rdquo; uses the saved settings.</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy !== null || !dirty}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
            <Button type="button" variant="secondary" onClick={test} disabled={busy !== null || !canTest}
              title={canTest ? undefined : 'Enter the server, share, username and password first'}>
              {busy === 'test' ? 'Testing…' : 'Test connection'}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel>
        <p className="label-overline mb-3">History</p>
        {runs.length === 0 ? (
          <p className="text-sm text-muted">No backups have run yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Result</th>
                  <th className="py-2 pr-4 font-medium">By</th>
                  <th className="py-2 pr-4 font-medium">Database</th>
                  <th className="py-2 pr-4 font-medium">Files copied</th>
                  <th className="py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-registry align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{when(r.startedAt)}</td>
                    <td className="py-2 pr-4"><Badge tone={TONE[r.status]}>{r.status}</Badge></td>
                    <td className="py-2 pr-4 capitalize">{r.trigger === 'manual' ? (r.triggeredByName || 'manual') : 'schedule'}</td>
                    <td className="py-2 pr-4">{r.databaseBytes ? bytes(r.databaseBytes) : '—'}</td>
                    <td className="py-2 pr-4">
                      {r.status === 'running' ? '…' : `${r.filesCopied} (${bytes(r.filesBytes)}), ${r.filesSkipped} unchanged`}
                    </td>
                    <td className="py-2 text-[var(--status-danger-fg)]">{r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted mt-3">
          Files removed from DRFMS (for example after disposal) stay in the backup until you clear them on the share.
          To restore from a backup, follow the steps in RESTORE.md in the backups app.
        </p>
      </Panel>
    </PageShell>
  )
}
