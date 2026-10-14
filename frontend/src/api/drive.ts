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

let seriesCache: RecordSeriesItem[] | null = null

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
  moveRecords: (recordIds: string[], recordSeries: string | number | null) =>
    client.post<{ detail: string; count: number }>('/records/bulk/', { recordIds, recordSeries }),
  thumbnail: (recordId: string) =>
    client.get<Blob>(`/records/${recordId}/thumbnail/`, { responseType: 'blob', validateStatus: (s) => s === 200 || s === 204 }),
}

/** Changes in Quick access (pin / unpin) tell the sidebar to reload. */
export const PINS_CHANGED_EVENT = 'drfms:pins-changed'

/** A folder (record series) was created, so lists of series should reload. */
export const SERIES_CHANGED_EVENT = "drfms:series-changed"
