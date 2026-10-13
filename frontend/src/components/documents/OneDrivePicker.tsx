import { useCallback, useEffect, useRef, useState } from 'react'
import { Folder, FileText, X, ChevronRight } from 'lucide-react'
import type { AccountInfo } from '@azure/msal-browser'
import type { OneDriveSettings } from '@/api/onedrive'
import { Button } from '@/components/ui/Button'
import { formatFileSize } from '@/utils/fileType'
import {
  IMPORTABLE, MAX_IMPORT_BYTES, disconnect, downloadFile, getToken, listFolder, signIn, type DriveItem,
} from '@/lib/onedrive'

interface Props {
  settings: OneDriveSettings
  onClose: () => void
  onPick: (files: File[]) => void
}

interface Crumb { id?: string; name: string }

export function OneDrivePicker({ settings, onClose, onPick }: Props) {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [path, setPath] = useState<Crumb[]>([{ name: 'OneDrive' }])
  const [items, setItems] = useState<DriveItem[]>([])
  const [selected, setSelected] = useState<Record<string, DriveItem>>({})
  const [busy, setBusy] = useState<'signin' | 'list' | 'import' | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ index: number; total: number; name: string; fraction: number } | null>(null)
  const abort = useRef<AbortController | null>(null)

  const open = useCallback(async (acct: AccountInfo, crumbs: Crumb[]) => {
    setBusy('list')
    setError('')
    try {
      const token = await getToken(settings, acct)
      setItems(await listFolder(token, crumbs[crumbs.length - 1].id))
      setPath(crumbs)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }, [settings])

  const connect = async () => {
    setBusy('signin')
    setError('')
    try {
      const { account: acct } = await signIn(settings)
      setAccount(acct)
      await open(acct, [{ name: 'OneDrive' }])
    } catch (e) {
      const msg = (e as Error).message || ''
      setError(/user_cancelled|popup_window_error/.test(msg) ? 'Sign-in was cancelled or the popup was blocked.' : msg)
      setBusy(null)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (it: DriveItem) =>
    setSelected((s) => {
      const next = { ...s }
      if (next[it.id]) delete next[it.id]
      else next[it.id] = it
      return next
    })

  const doImport = async () => {
    if (!account) return
    setBusy('import')
    setError('')
    const controller = new AbortController()
    abort.current = controller
    const chosen = Object.values(selected)
    try {
      const token = await getToken(settings, account)
      const files: File[] = []
      // One at a time, so memory use is bounded by the largest single file and cancelling is quick.
      for (const [index, it] of chosen.entries()) {
        setProgress({ index, total: chosen.length, name: it.name, fraction: 0 })
        files.push(await downloadFile(token, it, (fraction) =>
          setProgress({ index, total: chosen.length, name: it.name, fraction }), controller.signal))
      }
      onPick(files)
      onClose()
    } catch (e) {
      const cancelled = (e as Error).name === 'AbortError'
      setError(cancelled ? 'Import cancelled. Nothing was added.' : (e as Error).message)
      setBusy(null)
      setProgress(null)
    } finally {
      abort.current = null
    }
  }

  const cancelImport = () => abort.current?.abort()

  const leave = async () => {
    await disconnect(settings).catch(() => undefined)
    onClose()
  }

  const count = Object.keys(selected).length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Import from OneDrive">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} aria-hidden />
      <div className="panel relative w-full max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-registry">
          <h2 className="font-semibold text-sm">Import from OneDrive</h2>
          <button type="button" className="transfer-icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {error && <div className="alert-danger m-3" role="alert">{error}</div>}

        {!account ? (
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-secondary">
              Sign in with your own Microsoft 365 account to pick files. DRFMS can only read files you choose,
              and your Microsoft sign-in stays in your browser.
            </p>
            <Button onClick={connect} disabled={busy !== null}>
              {busy === 'signin' ? 'Waiting for sign-in…' : 'Sign in with Microsoft'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 px-4 py-2 text-xs text-muted flex-wrap border-b border-registry">
              {path.map((c, i) => (
                <span key={`${c.id ?? 'root'}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} />}
                  <button
                    type="button"
                    className="hover:underline disabled:no-underline"
                    disabled={i === path.length - 1 || busy !== null}
                    onClick={() => open(account, path.slice(0, i + 1))}
                  >{c.name}</button>
                </span>
              ))}
              <span className="ml-auto">{account.username}</span>
            </div>
            <ul className="overflow-y-auto flex-1 min-h-48">
              {busy === 'list' && <li className="px-4 py-3 text-sm text-muted">Loading…</li>}
              {busy !== 'list' && items.length === 0 && <li className="px-4 py-3 text-sm text-muted">This folder is empty.</li>}
              {items.map((it) => {
                const tooBig = !it.isFolder && it.size > MAX_IMPORT_BYTES
                const ok = it.isFolder || (IMPORTABLE.test(it.name) && !tooBig)
                return (
                  <li key={it.id} className="flex items-center gap-3 px-4 py-2 border-b border-registry last:border-0 text-sm">
                    {it.isFolder ? (
                      <button type="button" className="flex items-center gap-3 flex-1 text-left hover:underline"
                        onClick={() => open(account, [...path, { id: it.id, name: it.name }])}>
                        <Folder size={16} className="text-muted shrink-0" /><span className="truncate">{it.name}</span>
                      </button>
                    ) : (
                      <label className={`flex items-center gap-3 flex-1 min-w-0 ${ok ? 'cursor-pointer' : 'opacity-50'}`}>
                        <input type="checkbox" disabled={!ok} checked={Boolean(selected[it.id])} onChange={() => toggle(it)} />
                        <FileText size={16} className="text-muted shrink-0" />
                        <span className="truncate flex-1">{it.name}</span>
                        <span className="text-xs text-muted tabular-nums">{tooBig ? `Over ${MAX_IMPORT_BYTES / 1024 / 1024} MB` : ok ? formatFileSize(it.size) : 'Not supported'}</span>
                      </label>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-registry">
              {busy === 'import' && progress ? (
                <>
                  <span className="text-sm truncate flex-1" role="status">
                    Importing {progress.index + 1} of {progress.total}: {progress.name} {Math.round(progress.fraction * 100)}%
                  </span>
                  <Button variant="secondary" onClick={cancelImport}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button onClick={doImport} disabled={count === 0 || busy !== null}>
                    {`Import ${count || ''} file${count === 1 ? '' : 's'}`.replace('Import  ', 'Import ')}
                  </Button>
                  <Button variant="ghost" onClick={leave} disabled={busy !== null}>Disconnect</Button>
                  <span className="ml-auto text-xs text-muted">PDF, Word and image files, up to {MAX_IMPORT_BYTES / 1024 / 1024} MB</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
