export type TransferStatus = 'queued' | 'transferring' | 'completed' | 'error' | 'cancelled'

export type TransferType = 'upload' | 'download'

export interface TransferItem {
  id: string
  type: TransferType
  name: string
  progress: number
  status: TransferStatus
  loaded: number
  total: number
  speedBps: number
  error?: string
  recordId?: string
  startedAt: number
  completedAt?: number
}

export interface UploadMetadata {
  title?: string
  description?: string
  document_type?: string
  classification_level?: string
  originating_ministry?: string
  document_date?: string
  physical_file_ref?: string
  is_vital?: boolean
  change_summary?: string
}
