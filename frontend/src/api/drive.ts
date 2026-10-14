import client from './client'

export interface StorageUsage { usedBytes: number; quotaBytes: number | null; recordCount: number }
export type PinSharing = '' | 'department' | 'all'
export interface PinnedView {
  id: number
  label: string
  target: string
  sharedWith: PinSharing
  /** False for a view a colleague shared with you. */
  own: boolean
  ownerName: string
}
export type NewDocumentKind = 'word' | 'excel' | 'powerpoint'
export interface RecordSeriesItem {
  id: number
  code: string
  name: string
  parent: number | null
  isActive: boolean
}

let seriesCache: RecordSeriesItem[] | null = null

export interface BinItem {
  id: string
  referenceNumber: string
  title: string
  classificationLevel: string
  documentType: string
  recordSeriesName: string
  fileName: string
  fileSize: number
  deletedAt: string
  deletedByName: string
}

export interface RecordsDeletedDetail { ids: string[]; title?: string }

export const driveApi = {
  storage: () => client.get<StorageUsage>('/records/storage/'),
  pins: () => client.get<PinnedView[]>('/records/pins/'),
  pin: (label: string, target: string, sharedWith: PinSharing = '') => client.post<PinnedView>('/records/pins/', { label, target, sharedWith }),
  updatePin: (id: number, body: { label?: string; sharedWith?: PinSharing }) => client.patch<PinnedView>(`/records/pins/${id}/`, body),
  unpin: (id: number) => client.delete(`/records/pins/${id}/`),
  newDocument: (kind: NewDocumentKind, title: string, recordSeries?: string | number) =>
    client.post<{ id: string; referenceNumber: string }>('/records/new-document/', {
      kind, title, ...(recordSeries ? { recordSeries } : {}),
    }),
  series: () => client.get<RecordSeriesItem[] | { results: RecordSeriesItem[] }>('/records/series/'),
  /** Active series, kept for the session; call `refreshSeries` after creating a folder. */
  activeSeries: async (force = false): Promise<RecordSeriesItem[]> => {
    if (!seriesCache || force) {
      const { data } = await client.get<RecordSeriesItem[] | { results: RecordSeriesItem[] }>('/records/series/')
      seriesCache = (Array.isArray(data) ? data : data.results).filter((s) => s.isActive)
    }
    return seriesCache
  },
  newFolder: (name: string, parent?: string | number | null, retentionYears?: number) =>
    client.post<{ id: number; code: string; name: string; parent: number | null; retentionYears: number }>('/records/folders/', {
      name, ...(parent ? { parent } : {}), ...(retentionYears !== undefined ? { retentionYears } : {}),
    }),
  bin: (q?: string) => client.get<{ count: number; results: BinItem[] }>('/records/bin/', { params: q ? { q } : {} }),
  restoreFromBin: (recordIds: string[]) =>
    client.post<{ restored: string[]; failed: Array<{ id: string; title: string; detail: string }>; count: number }>('/records/bin/restore/', { recordIds }),
  moveRecords: (recordIds: string[], recordSeries: string | number | null) =>
    client.post<{ detail: string; count: number }>('/records/bulk/', { recordIds, recordSeries }),
  thumbnail: (recordId: string) =>
    client.get<Blob>(`/records/${recordId}/thumbnail/`, { responseType: 'blob', validateStatus: (s) => s === 200 || s === 204 }),
}

/** Changes in Quick access (pin / unpin) tell the sidebar to reload. */
export const PINS_CHANGED_EVENT = 'drfms:pins-changed'

/** A folder (record series) was created, so lists of series should reload. */
export const SERIES_CHANGED_EVENT = "drfms:series-changed"

/** Announce that records were moved to the Recycle bin (shows the Undo message). */
export const RECORDS_DELETED_EVENT = 'drfms:records-deleted'
/** Records were restored or otherwise changed elsewhere: lists should reload. */
export const RECORDS_CHANGED_EVENT = 'drfms:records-changed'
