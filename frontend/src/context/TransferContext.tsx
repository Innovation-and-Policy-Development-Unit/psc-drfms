import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { TransferItem, UploadMetadata } from '@/types/transfer'
import { uploadRecordWithProgress, downloadVersionWithProgress } from '@/api/transfers'
import * as recordsApi from '@/api/records'

interface TransferContextValue {
  transfers: TransferItem[]
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  togglePanel: () => void
  activeCount: number
  uploadProgress: number
  downloadProgress: number
  queueUpload: (file: File, metadata?: UploadMetadata) => string
  queueDownload: (recordId: string, fileName: string, versionId?: string) => Promise<string>
  cancelTransfer: (id: string) => void
  clearCompleted: () => void
  clearAll: () => void
}

const TransferContext = createContext<TransferContextValue | null>(null)

function uid() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function defaultMetadata(file: File): UploadMetadata {
  return {
    title: file.name.replace(/\.[^.]+$/, ''),
    document_type: 'other',
    classification_level: 'internal',
    change_summary: 'Initial upload',
  }
}

export function TransferProvider({ children }: { children: ReactNode }) {
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const abortMap = useRef<Map<string, AbortController>>(new Map())
  const speedMap = useRef<Map<string, { lastLoaded: number; lastTime: number }>>(new Map())

  const patchTransfer = useCallback((id: string, patch: Partial<TransferItem>) => {
    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const runUpload = useCallback(async (id: string, file: File, metadata: UploadMetadata) => {
    const controller = new AbortController()
    abortMap.current.set(id, controller)
    patchTransfer(id, { status: 'transferring', startedAt: Date.now() })

    try {
      const { data } = await uploadRecordWithProgress(
        file,
        metadata,
        (loaded, total) => {
          const now = Date.now()
          const prev = speedMap.current.get(id)
          let speedBps = 0
          if (prev) {
            const dt = (now - prev.lastTime) / 1000
            if (dt > 0) speedBps = (loaded - prev.lastLoaded) / dt
          }
          speedMap.current.set(id, { lastLoaded: loaded, lastTime: now })
          const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
          patchTransfer(id, { loaded, total, progress, speedBps })
        },
        controller.signal,
      )
      patchTransfer(id, {
        status: 'completed',
        progress: 100,
        loaded: file.size,
        total: file.size,
        recordId: data.id,
        completedAt: Date.now(),
      })
    } catch (err) {
      if (controller.signal.aborted) {
        patchTransfer(id, { status: 'cancelled' })
      } else {
        patchTransfer(id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
      }
    } finally {
      abortMap.current.delete(id)
      speedMap.current.delete(id)
    }
  }, [patchTransfer])

  const runDownload = useCallback(async (id: string, recordId: string, versionId: string, fileName: string) => {
    const controller = new AbortController()
    abortMap.current.set(id, controller)
    patchTransfer(id, { status: 'transferring', startedAt: Date.now() })

    try {
      const { data } = await downloadVersionWithProgress(
        recordId,
        versionId,
        false,
        (loaded, total) => {
          const now = Date.now()
          const prev = speedMap.current.get(id)
          let speedBps = 0
          if (prev) {
            const dt = (now - prev.lastTime) / 1000
            if (dt > 0) speedBps = (loaded - prev.lastLoaded) / dt
          }
          speedMap.current.set(id, { lastLoaded: loaded, lastTime: now })
          const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
          patchTransfer(id, { loaded, total, progress, speedBps })
        },
        controller.signal,
      )
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      patchTransfer(id, {
        status: 'completed',
        progress: 100,
        completedAt: Date.now(),
      })
    } catch (err) {
      if (controller.signal.aborted) {
        patchTransfer(id, { status: 'cancelled' })
      } else {
        patchTransfer(id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Download failed',
        })
      }
    } finally {
      abortMap.current.delete(id)
      speedMap.current.delete(id)
    }
  }, [patchTransfer])

  const queueUpload = useCallback((file: File, metadata?: UploadMetadata) => {
    const id = uid()
    const item: TransferItem = {
      id,
      type: 'upload',
      name: file.name,
      progress: 0,
      status: 'queued',
      loaded: 0,
      total: file.size,
      speedBps: 0,
      startedAt: Date.now(),
    }
    setTransfers((prev) => [item, ...prev])
    setPanelOpen(true)
    void runUpload(id, file, { ...defaultMetadata(file), ...metadata })
    return id
  }, [runUpload])

  const queueDownload = useCallback(async (recordId: string, fileName: string, versionId?: string) => {
    let vid = versionId
    if (!vid) {
      const { data } = await recordsApi.getRecord(recordId)
      const detail = data as { latestVersion?: { id: string }; latest_version?: { id: string } }
      vid = detail.latestVersion?.id ?? detail.latest_version?.id
    }
    if (!vid) throw new Error('No file version available')

    const id = uid()
    const item: TransferItem = {
      id,
      type: 'download',
      name: fileName,
      progress: 0,
      status: 'queued',
      loaded: 0,
      total: 0,
      speedBps: 0,
      recordId,
      startedAt: Date.now(),
    }
    setTransfers((prev) => [item, ...prev])
    setPanelOpen(true)
    void runDownload(id, recordId, vid, fileName)
    return id
  }, [runDownload])

  const cancelTransfer = useCallback((id: string) => {
    abortMap.current.get(id)?.abort()
    patchTransfer(id, { status: 'cancelled' })
  }, [patchTransfer])

  const clearCompleted = useCallback(() => {
    setTransfers((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'))
  }, [])

  const clearAll = useCallback(() => {
    transfers.forEach((t) => {
      if (t.status === 'transferring' || t.status === 'queued') {
        abortMap.current.get(t.id)?.abort()
      }
    })
    setTransfers([])
  }, [transfers])

  const active = transfers.filter((t) => t.status === 'transferring' || t.status === 'queued')
  const activeUploads = active.filter((t) => t.type === 'upload')
  const activeDownloads = active.filter((t) => t.type === 'download')

  const avgProgress = (items: TransferItem[]) => {
    if (items.length === 0) return 0
    return Math.round(items.reduce((s, t) => s + t.progress, 0) / items.length)
  }

  const value: TransferContextValue = {
    transfers,
    panelOpen,
    setPanelOpen,
    togglePanel: () => setPanelOpen((o) => !o),
    activeCount: active.length,
    uploadProgress: avgProgress(activeUploads),
    downloadProgress: avgProgress(activeDownloads),
    queueUpload,
    queueDownload,
    cancelTransfer,
    clearCompleted,
    clearAll,
  }

  return (
    <TransferContext.Provider value={value}>
      {children}
    </TransferContext.Provider>
  )
}

export function useTransfers() {
  const ctx = useContext(TransferContext)
  if (!ctx) throw new Error('useTransfers requires TransferProvider')
  return ctx
}
