import axios from 'axios'
import client from './client'

export interface AiEngineInfo { provider: string; model: string; external: boolean }
export interface AiStatus {
  enabled: boolean
  primary: AiEngineInfo | null
  local: AiEngineInfo | null
  externalMaxClassification: string | null
  visionOcr: boolean
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface AskSource {
  n: number
  recordId: string
  title: string
  referenceNumber: string
  documentType: string
  snippet: string
  similarity: number | null
  cited: boolean
}
export interface AskResponse { answer: string; sources: AskSource[]; excludedRecords: number; engine: string }

export interface ReviewItem {
  recordId: string
  title: string
  referenceNumber: string
  documentType: string
  classificationLevel: string
  createdAt: string
  summary: string
  reasons: string[]
}

export interface RouteSuggestion {
  department: { id: number; code: string; name: string } | null
  assignees: Array<{ id: number; name: string; role: string }>
  priority: string | null
  reason: string
  confidence: number
  engine: string
}

export interface ParsedSearch {
  q: string
  filters: { documentType?: string; classificationLevel?: string; ministry?: string; recordSeries?: string; dateFrom?: string; dateTo?: string }
  unsupported: string[]
  engine: string
}

export const aiApi = {
  status: () => client.get<AiStatus>('/ai/status/'),
  ask: (messages: ChatMessage[]) => client.post<AskResponse>('/ai/ask/', { messages }),
  chat: (recordId: string, messages: ChatMessage[]) =>
    client.post<{ answer: string; engine: string }>(`/ai/records/${recordId}/chat/`, { messages }),
  summarize: (recordId: string) => client.post(`/ai/records/${recordId}/summary/`),
  analyze: (recordId: string) => client.post(`/ai/records/${recordId}/analyze/`),
  applyRetention: (recordId: string, recordSeries: string) =>
    client.post<{ recordSeries: string; seriesLabel: string; retentionDate: string }>(
      `/ai/records/${recordId}/apply-retention/`, { recordSeries }),
  markReviewed: (recordId: string) => client.post(`/ai/records/${recordId}/review/`),
  reviewQueue: () => client.get<{ results: ReviewItem[]; count: number }>('/ai/review-queue/'),
  routeCorrespondence: (id: string) => client.post<RouteSuggestion>(`/ai/correspondence/${id}/route/`),
  draftReply: (id: string, instructions = '') =>
    client.post<{ draft: string; engine: string }>(`/ai/correspondence/${id}/draft-reply/`, { instructions }),
  parseSearch: (text: string) => client.post<ParsedSearch>('/ai/search/parse/', { text }),
}

/** Human-readable reason from a failed AI request. */
export function aiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 429) return 'You are asking too quickly. Wait a moment and try again.'
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail
    if (detail) return detail
  }
  return 'Something went wrong. Please try again.'
}
