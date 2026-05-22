export * as authApi from './auth'
export * as recordsApi from './records'
export { default as client } from './client'

import client from './client'

export const searchApi = {
  search: (params) => client.get('/search/', { params }),
  analytics: () => client.get('/search/analytics/'),
}

export const workflowApi = {
  getTemplates: () => client.get('/workflows/templates/'),
  getInstances: (params) => client.get('/workflows/instances/', { params }),
  getInstance: (id) => client.get(`/workflows/instances/${id}/`),
  createInstance: (data) => client.post('/workflows/instances/', data),
  actionWorkflow: (id, data) => client.post(`/workflows/instances/${id}/action/`, data),
  getMyTasks: () => client.get('/workflows/my-tasks/'),
}

export const correspondenceApi = {
  list: (params) => client.get('/correspondence/', { params }),
  get: (id) => client.get(`/correspondence/${id}/`),
  create: (data) => client.post('/correspondence/', data),
  update: (id, data) => client.patch(`/correspondence/${id}/`, data),
}

export const complianceApi = {
  getLegalHolds: () => client.get('/compliance/legal-holds/'),
  createLegalHold: (data) => client.post('/compliance/legal-holds/', data),
  liftLegalHold: (id) => client.post(`/compliance/legal-holds/${id}/lift/`),
  getDestructions: () => client.get('/compliance/destruction/'),
  createDestruction: (data) => client.post('/compliance/destruction/', data),
  approveDestruction: (id, action) => client.post(`/compliance/destruction/${id}/approve/`, { action }),
  getOverdueRecords: () => client.get('/compliance/overdue/'),
}

export const analyticsApi = {
  getDashboard: () => client.get('/analytics/dashboard/'),
  getRecordsByType: () => client.get('/analytics/records-by-type/'),
  getRecordsByMonth: () => client.get('/analytics/records-by-month/'),
  getWorkflowPerformance: () => client.get('/analytics/workflow-performance/'),
  getUserActivity: () => client.get('/analytics/user-activity/'),
  getComplianceDashboard: () => client.get('/analytics/compliance/'),
}

export const sharingApi = {
  getLinks: (params) => client.get('/sharing/', { params }),
  createLink: (data) => client.post('/sharing/', data),
  revokeLink: (token) => client.post(`/sharing/${token}/revoke/`),
  viewShared: (token) => client.get(`/sharing/${token}/view/`),
}

export const collaborationApi = {
  getComments: (recordId) => client.get(`/collaboration/records/${recordId}/comments/`),
  createComment: (recordId, data) => client.post(`/collaboration/records/${recordId}/comments/`, data),
  deleteComment: (id) => client.delete(`/collaboration/comments/${id}/`),
  getReviewRounds: (recordId) => client.get(`/collaboration/records/${recordId}/review-rounds/`),
  createReviewRound: (recordId, data) => client.post(`/collaboration/records/${recordId}/review-rounds/`, data),
  closeReviewRound: (id) => client.post(`/collaboration/review-rounds/${id}/close/`),
  respondToReview: (id, data) => client.post(`/collaboration/review-rounds/${id}/respond/`, data),
}

export const auditApi = {
  getLogs: (params) => client.get('/audit/logs/', { params }),
  getCustodyChain: (recordId) => client.get(`/audit/custody/${recordId}/`),
}

export const notificationsApi = {
  list: (params) => client.get('/notifications/', { params }),
  activity: (params) => client.get('/notifications/activity/', { params }),
  markRead: (id) => client.post(`/notifications/${id}/read/`),
  markAllRead: () => client.post('/notifications/mark-all-read/'),
}

export const onlyofficeApi = {
  getConfig: (recordId, versionId) => client.get(`/onlyoffice/config/${recordId}/${versionId}/`),
}
