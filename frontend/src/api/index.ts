export { default as client, unwrapList } from './client'
export * as authApi from './auth'
export * as recordsApi from './records'

import client from './client'
import type {
  ComplianceDashboard,
  Correspondence,
  DashboardStats,
  DestructionCertificate,
  HealthCheck,
  LegalHold,
  PaginatedResponse,
  RecordListItem,
  RetentionSchedule,
  User,
  WorkflowInstance,
  WorkflowPerformance,
  WorkflowAction,
  AnalyticsOverview,
} from '@/types/api'

export const searchApi = {
  search: (params: Record<string, string | number | undefined>) =>
    client.get<{ results: RecordListItem[]; count: number; query: string }>('/search/', { params }),
  analytics: () => client.get<Array<{ query: string; count: number; lastSearched: string }>>('/search/analytics/'),
}

export const workflowApi = {
  getTemplates: () => client.get('/workflows/templates/'),
  getInstances: (params?: Record<string, string>) =>
    client.get<PaginatedResponse<WorkflowInstance> | WorkflowInstance[]>('/workflows/instances/', { params }),
  getInstance: (id: string) => client.get<WorkflowInstance>(`/workflows/instances/${id}/`),
  createInstance: (data: Record<string, unknown>) => client.post('/workflows/instances/', data),
  actionWorkflow: (id: string, data: Record<string, unknown>) =>
    client.post(`/workflows/instances/${id}/action/`, data),
  getMyTasks: () => client.get<PaginatedResponse<WorkflowAction> | WorkflowAction[]>('/workflows/my-tasks/'),
}

export const correspondenceApi = {
  list: (params?: Record<string, string>) =>
    client.get<PaginatedResponse<Correspondence> | Correspondence[]>('/correspondence/', { params }),
  get: (id: string) => client.get<Correspondence>(`/correspondence/${id}/`),
  create: (data: Record<string, unknown>) => client.post<Correspondence>('/correspondence/', data),
  update: (id: string, data: Record<string, unknown>) => client.patch(`/correspondence/${id}/`, data),
}

export const complianceApi = {
  getLegalHolds: () => client.get<PaginatedResponse<LegalHold> | LegalHold[]>('/compliance/legal-holds/'),
  createLegalHold: (data: Record<string, unknown>) => client.post<LegalHold>('/compliance/legal-holds/', data),
  liftLegalHold: (id: string) => client.post(`/compliance/legal-holds/${id}/lift/`),
  getDestructions: () =>
    client.get<PaginatedResponse<DestructionCertificate> | DestructionCertificate[]>('/compliance/destruction/'),
  createDestruction: (data: Record<string, unknown>) =>
    client.post<DestructionCertificate>('/compliance/destruction/', data),
  approveDestruction: (id: string, action: string) =>
    client.post(`/compliance/destruction/${id}/approve/`, { action }),
  getRetentionSchedules: () =>
    client.get<PaginatedResponse<RetentionSchedule> | RetentionSchedule[]>('/compliance/retention/'),
  createRetentionSchedule: (data: Record<string, unknown>) =>
    client.post<RetentionSchedule>('/compliance/retention/', data),
  getOverdueRecords: () => client.get<RecordListItem[]>('/compliance/overdue/'),
}

export const analyticsApi = {
  getOverview: () => client.get<AnalyticsOverview>('/analytics/overview/'),
  getDashboard: () => client.get<DashboardStats>('/analytics/dashboard/'),
  getRecordsByType: () => client.get<Array<{ documentType: string; count: number }>>('/analytics/records-by-type/'),
  getRecordsByMonth: () => client.get<Array<{ month: string; count: number }>>('/analytics/records-by-month/'),
  getWorkflowPerformance: () => client.get<WorkflowPerformance>('/analytics/workflow-performance/'),
  getUserActivity: () =>
    client.get<Array<{ userEmail: string; userFirstName: string; userLastName: string; actionCount: number }>>(
      '/analytics/user-activity/',
    ),
  getComplianceDashboard: () => client.get<ComplianceDashboard>('/analytics/compliance/'),
}

export const systemApi = {
  getHealth: () => client.get<HealthCheck>('/health/'),
}

export const sharingApi = {
  getLinks: (params?: Record<string, string>) => client.get('/sharing/', { params }),
  createLink: (data: Record<string, unknown>) => client.post('/sharing/', data),
  revokeLink: (token: string) => client.post(`/sharing/${token}/revoke/`),
  viewShared: (token: string) => client.get(`/sharing/${token}/view/`),
}

export const collaborationApi = {
  getComments: (recordId: string) => client.get(`/collaboration/records/${recordId}/comments/`),
  createComment: (recordId: string, data: Record<string, unknown>) =>
    client.post(`/collaboration/records/${recordId}/comments/`, data),
  deleteComment: (id: string) => client.delete(`/collaboration/comments/${id}/`),
  getReviewRounds: (recordId: string) => client.get(`/collaboration/records/${recordId}/review-rounds/`),
  createReviewRound: (recordId: string, data: Record<string, unknown>) =>
    client.post(`/collaboration/records/${recordId}/review-rounds/`, data),
  closeReviewRound: (id: string) => client.post(`/collaboration/review-rounds/${id}/close/`),
  respondToReview: (id: string, data: Record<string, unknown>) =>
    client.post(`/collaboration/review-rounds/${id}/respond/`, data),
}

export const auditApi = {
  getLogs: (params?: Record<string, string | number>) => client.get('/audit/logs/', { params }),
  getCustodyChain: (recordId: string) => client.get(`/audit/custody/${recordId}/`),
}

export const notificationsApi = {
  list: (params?: Record<string, string | number>) => client.get('/notifications/', { params }),
  activity: (params?: Record<string, string | number>) => client.get('/notifications/activity/', { params }),
  markRead: (id: string) => client.post(`/notifications/${id}/read/`),
  markAllRead: () => client.post('/notifications/mark-all-read/'),
}

export const onlyofficeApi = {
  getConfig: (recordId: string, versionId: string) =>
    client.get(`/onlyoffice/config/${recordId}/${versionId}/`),
}

export type { User }
