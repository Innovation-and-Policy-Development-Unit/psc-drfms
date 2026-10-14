import client from './client'

export interface StorageUsage { usedBytes: number; quotaBytes: number | null; recordCount: number }
export interface PinnedView { id: number; label: string; target: string }
export type NewDocumentKind = 'word' | 'excel' | 'powerpoint'
export interface RecordSeriesItem {
  id: number
  code: string
  name: string
  parent: number | null
  isActive: boolean
}

export const driveApi = {
  storage: () => client.get<StorageUsage>('/records/storage/'),
  pins: () => client.get<PinnedView[]>('/records/pins/'),
  pin: (label: string, target: string) => client.post<PinnedView>('/records/pins/', { label, target }),
  unpin: (id: number) => client.delete(`/records/pins/${id}/`),
  newDocument: (kind: NewDocumentKind, title: string, recordSeries?: string | number) =>
    client.post<{ id: string; referenceNumber: string }>('/records/new-document/', {
      kind, title, ...(recordSeries ? { recordSeries } : {}),
    }),
  series: () => client.get<RecordSeriesItem[] | { results: RecordSeriesItem[] }>('/records/series/'),
  moveRecords: (recordIds: string[], recordSeries: string | number | null) =>
    client.post<{ detail: string; count: number }>('/records/bulk/', { recordIds, recordSeries }),
  thumbnail: (recordId: string) =>
    client.get<Blob>(`/records/${recordId}/thumbnail/`, { responseType: 'blob', validateStatus: (s) => s === 200 || s === 204 }),
}

/** Changes in Quick access (pin / unpin) tell the sidebar to reload. */
export const PINS_CHANGED_EVENT = 'drfms:pins-changed'
