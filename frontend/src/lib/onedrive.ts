/**
 * Read-only access to the signed-in user's own OneDrive, entirely from the browser.
 *
 * The user signs in to Microsoft in a popup (MSAL, authorization code + PKCE). The
 * access token stays in this tab's sessionStorage and is only ever sent to Microsoft
 * Graph — DRFMS' server never sees it.
 */
import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser'
import type { OneDriveSettings } from '@/api/onedrive'

const SCOPES = ['Files.Read']
const GRAPH = 'https://graph.microsoft.com/v1.0'

export const IMPORTABLE = /\.(pdf|docx?|png|jpe?g|tiff?)$/i

// The upload check trusts the browser-reported type, which OneDrive downloads often leave blank.
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tif: 'image/tiff',
  tiff: 'image/tiff',
}

export interface DriveItem {
  id: string
  name: string
  size: number
  isFolder: boolean
  modified?: string
}

interface GraphItem {
  id: string
  name: string
  size?: number
  folder?: unknown
  lastModifiedDateTime?: string
}

let app: PublicClientApplication | null = null
let appKey = ''

export const redirectUri = () => `${window.location.origin}/blank.html`

async function getApp(cfg: OneDriveSettings) {
  const key = `${cfg.clientId}|${cfg.tenantId}`
  if (!app || appKey !== key) {
    app = new PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
        redirectUri: redirectUri(),
      },
      cache: { cacheLocation: 'sessionStorage' },
    })
    appKey = key
    await app.initialize()
  }
  return app
}

export async function signIn(cfg: OneDriveSettings): Promise<{ account: AccountInfo; token: string }> {
  const msal = await getApp(cfg)
  const result = await msal.acquireTokenPopup({ scopes: SCOPES, prompt: 'select_account', redirectUri: redirectUri() })
  return { account: result.account, token: result.accessToken }
}

/** A fresh token for an already signed-in account, refreshed quietly when it has expired. */
export async function getToken(cfg: OneDriveSettings, account: AccountInfo): Promise<string> {
  const msal = await getApp(cfg)
  try {
    return (await msal.acquireTokenSilent({ scopes: SCOPES, account })).accessToken
  } catch {
    return (await msal.acquireTokenPopup({ scopes: SCOPES, account, redirectUri: redirectUri() })).accessToken
  }
}

/** Forget this browser's Microsoft session for DRFMS (does not sign the user out of Microsoft). */
export async function disconnect(cfg: OneDriveSettings) {
  const msal = await getApp(cfg)
  await msal.clearCache()
}

async function graph(token: string, url: string, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal })
  if (!res.ok) {
    let detail = ''
    try { detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '' } catch { /* not JSON */ }
    throw new Error(detail || `OneDrive returned ${res.status}`)
  }
  return res
}

export async function listFolder(token: string, folderId?: string): Promise<DriveItem[]> {
  const base = folderId ? `${GRAPH}/me/drive/items/${encodeURIComponent(folderId)}/children` : `${GRAPH}/me/drive/root/children`
  let url: string | undefined = `${base}?$select=id,name,size,folder,lastModifiedDateTime&$top=200`
  const items: DriveItem[] = []
  while (url) {
    const data: { value: GraphItem[]; '@odata.nextLink'?: string } = await (await graph(token, url)).json()
    for (const it of data.value) {
      items.push({
        id: it.id, name: it.name, size: it.size ?? 0, isFolder: Boolean(it.folder), modified: it.lastModifiedDateTime,
      })
    }
    url = data['@odata.nextLink']
  }
  return items.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name))
}

/** The largest file DRFMS accepts (the server enforces the same limit). */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024

/** Download one file, reporting progress and stopping cleanly if the caller aborts. */
export async function downloadFile(
  token: string, item: DriveItem, onProgress?: (fraction: number) => void, signal?: AbortSignal,
): Promise<File> {
  const res = await graph(token, `${GRAPH}/me/drive/items/${encodeURIComponent(item.id)}/content`, signal)
  const total = item.size || Number(res.headers.get('content-length')) || 0
  const parts: BlobPart[] = []
  let received = 0
  if (res.body) {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      if (received > MAX_IMPORT_BYTES) {
        await reader.cancel()
        throw new Error(`${item.name} is larger than the ${MAX_IMPORT_BYTES / 1024 / 1024} MB limit.`)
      }
      parts.push(value as BlobPart) // chunks from a network stream are plain ArrayBuffer-backed
      if (total) onProgress?.(Math.min(1, received / total))
    }
  } else {
    parts.push(await res.arrayBuffer())
  }
  onProgress?.(1)
  const type = TYPES[item.name.split('.').pop()?.toLowerCase() ?? ''] ?? res.headers.get('content-type') ?? ''
  return new File(parts, item.name, { type, lastModified: item.modified ? Date.parse(item.modified) : Date.now() })
}
