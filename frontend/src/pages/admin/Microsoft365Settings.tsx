import { useEffect, useState } from 'react'
import { onedriveApi, type OneDriveSettings } from '@/api/onedrive'
import { redirectUri } from '@/lib/onedrive'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

function errorText(err: unknown) {
  const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data
  if (!data) return 'Something went wrong.'
  return Object.values(data).map((v) => (Array.isArray(v) ? v.join(' ') : String(v))).join(' ')
}

export default function Microsoft365Settings() {
  const [loaded, setLoaded] = useState<OneDriveSettings | null>(null)
  const [form, setForm] = useState({ enabled: false, clientId: '', tenantId: '' })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    onedriveApi.get().then(({ data }) => {
      setLoaded(data)
      setForm({ enabled: data.enabled, clientId: data.clientId, tenantId: data.tenantId })
    }).catch(() => setNotice({ ok: false, text: 'Could not load settings.' }))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const { data } = await onedriveApi.save(form)
      setLoaded(data)
      setNotice({ ok: true, text: 'Saved.' })
    } catch (err) {
      setNotice({ ok: false, text: errorText(err) })
    } finally {
      setSaving(false)
    }
  }

  const copy = (text: string) => navigator.clipboard?.writeText(text).catch(() => undefined)

  return (
    <PageShell title="Microsoft 365" subtitle="Let users import files from their own OneDrive.">
      {notice && <div className={`${notice.ok ? 'alert-success' : 'alert-danger'} mb-4`} role="status">{notice.text}</div>}

      {!loaded ? <Panel><Skeleton lines={4} /></Panel> : (
        <>
          <Panel className="mb-4">
            <form onSubmit={save} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Application (client) ID" value={form.clientId} autoComplete="off"
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  placeholder="00000000-0000-0000-0000-000000000000" />
                <Input label="Directory (tenant) ID" value={form.tenantId} autoComplete="off"
                  onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  hint='Or "organizations" to allow any work or school account.' />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
                Show "Import from OneDrive" on the upload page
              </label>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </form>
          </Panel>

          <Panel>
            <p className="label-overline mb-2">One-time setup in Microsoft Entra ID</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-sm text-secondary">
              <li>In the Entra admin centre, go to App registrations and choose New registration.</li>
              <li>Name it "PSC-DRFMS" and pick the account type that matches your organisation.</li>
              <li>
                Under Redirect URI choose <em>Single-page application (SPA)</em> and enter{' '}
                <code className="font-mono-ref">{redirectUri()}</code>{' '}
                <button type="button" className="underline text-xs" onClick={() => copy(redirectUri())}>Copy</button>.
                Use your real address if users reach DRFMS at a different one.
              </li>
              <li>Under API permissions add Microsoft Graph, delegated, <code className="font-mono-ref">Files.Read</code>. This lets users read only their own files, and only after they sign in.</li>
              <li>Copy the Application (client) ID and Directory (tenant) ID from the Overview page into the boxes above.</li>
            </ol>
            <p className="text-xs text-muted mt-3">
              No client secret is needed. Each user signs in with their own account, and Microsoft sign-in details are never sent to DRFMS.
              Imported files become records like any other upload, with the usual classification, retention and audit trail.
            </p>
          </Panel>
        </>
      )}
    </PageShell>
  )
}
