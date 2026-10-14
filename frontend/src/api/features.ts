import client from './client'
import type { RecordListItem } from '@/types/api'

// ---- relationships ----
export type RelationType = 'related' | 'replies_to' | 'supersedes' | 'refers_to' | 'annex_of'
export const RELATION_TYPES: Array<{ value: RelationType; label: string }> = [
  { value: 'related', label: 'Related to' },
  { value: 'replies_to', label: 'Replies to' },
  { value: 'supersedes', label: 'Supersedes' },
  { value: 'refers_to', label: 'Refers to' },
  { value: 'annex_of', label: 'Annex of' },
]
export interface RelationRow {
  id: number
  direction: 'out' | 'in'
  relationType: RelationType
  label: string
  note: string
  record: { id: string; title: string; referenceNumber: string; documentType: string; classificationLevel: string }
  createdByName: string
  createdAt: string
}

// ---- attachments ----
export interface AttachmentRow {
  id: number
  fileName: string
  fileSize: number
  mimeType: string
  role: 'annex' | 'pdf_copy'
  description: string
  createdAt: string
  uploadedByName: string
  removed: boolean
  /** indexed = its text is searchable; pending = still being read; none = nothing readable in it */
  textStatus: 'indexed' | 'pending' | 'none'
}

// ---- duplicates ----
export interface DuplicateBrief {
  id: string
  title: string
  referenceNumber: string
  documentType: string
  classificationLevel: string
  foundIn?: string
  similarity?: number
}
export interface DuplicateResult { index: number; exact: DuplicateBrief[]; similar: DuplicateBrief[] }

// ---- assignments ----
export interface Assignment {
  id: string
  recordId: string
  recordTitle: string
  referenceNumber: string
  assignedTo: number
  assignedToName: string
  assignedBy: number | null
  assignedByName: string
  instruction: string
  dueDate: string | null
  status: 'open' | 'done' | 'cancelled'
  isOverdue: boolean
  createdAt: string
  completedAt: string | null
  completedNote: string
}

// ---- templates ----
export interface DocTemplate {
  id: number
  name: string
  description: string
  kind: 'word' | 'excel' | 'powerpoint'
  fileName: string
  documentType: string
  classificationLevel: string
  recordSeries: number | null
  recordSeriesName: string
  titlePattern: string
  isActive: boolean
}

// ---- automatic permissions ----
export interface PermissionRuleRow {
  id: number
  name: string
  description: string
  department: number | null
  departmentName: string
  user: number | null
  userName: string
  recordSeries: number | null
  recordSeriesName: string
  includeSubseries: boolean
  documentType: string
  maxClassification: string
  canView: boolean
  canEdit: boolean
  canDownload: boolean
  canShare: boolean
  isActive: boolean
  matchingRecords: number
}

// ---- metadata profiles ----
export interface CustomFieldDef { key: string; label: string; kind: 'text' | 'number' | 'date'; required: boolean }
export interface MetadataProfile { requiredFields: string[]; customFields: CustomFieldDef[] }
export interface MetadataProfilesResponse {
  coreFields: Array<{ key: string; label: string }>
  documentTypes: Array<{ value: string; label: string }>
  profiles: Record<string, MetadataProfile>
}

// ---- advanced search ----
export interface SearchField {
  key: string
  label: string
  type: 'text' | 'fulltext' | 'choice' | 'series' | 'person' | 'date' | 'tag' | 'bool'
  operators: string[]
  choices: Array<{ value: string; label: string }> | null
}
export interface SearchCondition { field: string; op: string; value?: string | boolean; value2?: string }

export const featuresApi = {
  // relationships
  relations: (recordId: string) => client.get<{ results: RelationRow[] }>(`/records/${recordId}/relations/`),
  addRelation: (recordId: string, target: string, relationType: RelationType, note: string) =>
    client.post(`/records/${recordId}/relations/`, { target, relationType, note }),
  removeRelation: (recordId: string, relationId: number) => client.delete(`/records/${recordId}/relations/${relationId}/`),

  // attachments
  attachments: (recordId: string, includeRemoved = false) =>
    client.get<{ results: AttachmentRow[] }>(`/records/${recordId}/attachments/`, { params: includeRemoved ? { include_removed: 1 } : {} }),
  uploadAttachments: (recordId: string, files: File[], description = '') => {
    const form = new FormData()
    files.forEach((f) => form.append('file', f))
    if (description) form.append('description', description)
    return client.post<{ results: AttachmentRow[] }>(`/records/${recordId}/attachments/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  attachmentAction: (recordId: string, attachmentId: number, action: 'remove' | 'restore') =>
    client.post<AttachmentRow>(`/records/${recordId}/attachments/${attachmentId}/${action}/`),
  downloadAttachment: (recordId: string, attachmentId: number, inline = false) =>
    client.get<Blob>(`/records/${recordId}/attachments/${attachmentId}/download/`, { responseType: 'blob', params: inline ? { inline: 1 } : {} }),
  promoteAttachment: (recordId: string, attachmentId: number, body: { title?: string; classificationLevel?: string; recordSeries?: string }) =>
    client.post<{ id: string; referenceNumber: string }>(`/records/${recordId}/attachments/${attachmentId}/promote/`, body),
  attachRecord: (recordId: string, sourceId: string) =>
    client.post<{ results: AttachmentRow[]; attached: string }>(`/records/${recordId}/attachments/from-record/`, { record: sourceId }),

  // PDF conversion
  convertToPdf: (recordId: string, versionId: string | number, mode: 'download' | 'save') =>
    client.post(`/onlyoffice/convert/${recordId}/${versionId}/`, { mode }, mode === 'download' ? { responseType: 'blob' } : undefined),

  // duplicates
  checkDuplicates: (items: Array<{ name: string; sha256: string }>) =>
    client.post<{ results: DuplicateResult[] }>('/records/check-duplicates/', { items }),

  // assignments
  recordAssignments: (recordId: string) => client.get<{ results: Assignment[] }>(`/collaboration/records/${recordId}/assignments/`),
  assign: (recordId: string, body: { assignedTo: number; instruction: string; dueDate?: string }) =>
    client.post<Assignment>(`/collaboration/records/${recordId}/assignments/`, body),
  myAssignments: (params: { scope?: 'mine' | 'given'; status?: string } = {}) =>
    client.get<{ count: number; results: Assignment[] }>('/collaboration/assignments/', { params }),
  assignmentAction: (id: string, action: 'complete' | 'reopen' | 'cancel', note = '') =>
    client.post<Assignment>(`/collaboration/assignments/${id}/${action}/`, { note }),

  // templates
  templates: (all = false) => client.get<{ results: DocTemplate[] }>('/records/templates/', { params: all ? { all: 1 } : {} }),
  createTemplate: (form: FormData) => client.post<DocTemplate>('/records/templates/', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateTemplate: (id: number, body: Record<string, unknown>) => client.patch<DocTemplate>(`/records/templates/${id}/`, body),
  deleteTemplate: (id: number) => client.delete(`/records/templates/${id}/`),
  addStarterTemplates: () => client.post<{ added: string[] }>('/records/templates/starter/'),
  useTemplate: (id: number, title: string, recordSeries?: string | null) =>
    client.post<{ id: string; referenceNumber: string }>(`/records/templates/${id}/use/`, { title, ...(recordSeries ? { recordSeries } : {}) }),

  // automatic permissions
  rules: () => client.get<{ results: PermissionRuleRow[] }>('/records/permission-rules/'),
  createRule: (body: Record<string, unknown>) => client.post<PermissionRuleRow>('/records/permission-rules/', body),
  updateRule: (id: number, body: Record<string, unknown>) => client.patch<PermissionRuleRow>(`/records/permission-rules/${id}/`, body),
  deleteRule: (id: number) => client.delete(`/records/permission-rules/${id}/`),

  // metadata
  metadataProfiles: () => client.get<MetadataProfilesResponse>('/records/metadata-profiles/'),
  saveMetadataProfile: (documentType: string, profile: MetadataProfile) =>
    client.put<MetadataProfile>(`/records/metadata-profiles/${documentType}/`, profile),

  // advanced search
  searchFields: () => client.get<{ fields: SearchField[] }>('/search/advanced/fields/'),
  advancedSearch: (body: { conditions: SearchCondition[]; match: 'all' | 'any'; ordering?: string; page?: number; pageSize?: number }) =>
    client.post<{ count: number; page: number; pages: number; results: RecordListItem[] }>('/search/advanced/', body),
}

/** Message from a failed request, including one whose JSON body arrived as a Blob (file downloads). */
export async function readableError(err: unknown, fallback = 'Something went wrong. Please try again.'): Promise<string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data
  if (data instanceof Blob) {
    try { return (JSON.parse(await data.text()) as { detail?: string }).detail ?? fallback } catch { return fallback }
  }
  return (data as { detail?: string } | undefined)?.detail ?? fallback
}

/** SHA-256 of a file as hex, or null when the browser cannot hash (insecure page) or the file is very large. */
export async function sha256Hex(file: File): Promise<string | null> {
  if (!globalThis.crypto?.subtle || file.size > 100 * 1024 * 1024) return null
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Save a Blob the way a download link would. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
