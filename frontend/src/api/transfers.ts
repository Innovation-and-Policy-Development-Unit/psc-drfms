import client from './client'
import type { UploadMetadata } from '@/types/transfer'

export function uploadRecordWithProgress(
  file: File,
  metadata: UploadMetadata,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
) {
  const fd = new FormData()
  fd.append('file', file)
  const title = metadata.title?.trim() || file.name.replace(/\.[^.]+$/, '')
  fd.append('title', title)
  Object.entries(metadata).forEach(([k, v]) => {
    if (k === 'title' || v === '' || v == null) return
    fd.append(k, String(v))
  })
  if (!metadata.change_summary) fd.append('change_summary', 'Initial upload')

  return client.post<{ id: string }>('/records/', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
    onUploadProgress: (e) => {
      const total = e.total ?? file.size
      onProgress(e.loaded, total)
    },
  })
}

export function downloadVersionWithProgress(
  recordId: string,
  versionId: string,
  inline: boolean,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
) {
  return client.get<Blob>(`/records/${recordId}/versions/${versionId}/download/`, {
    params: inline ? { inline: 1 } : {},
    responseType: 'blob',
    signal,
    onDownloadProgress: (e) => {
      onProgress(e.loaded, e.total ?? e.loaded)
    },
  })
}
