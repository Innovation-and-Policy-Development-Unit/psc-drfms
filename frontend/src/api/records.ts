import client from './client'
import type { PaginatedResponse, RecordListItem } from '@/types/api'

export const getRecords = (params?: Record<string, string | number | boolean>) =>
  client.get<PaginatedResponse<RecordListItem> | RecordListItem[]>('/records/', { params })

export const getRecord = (id: string) => client.get(`/records/${id}/`)

export const createRecord = (formData: FormData) =>
  client.post('/records/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

export const updateRecord = (id: string, data: Record<string, unknown>) =>
  client.patch(`/records/${id}/`, data)

export const deleteRecord = (id: string) => client.delete(`/records/${id}/`)

export const starRecord = (id: string) => client.post(`/records/${id}/star/`)
export const unstarRecord = (id: string) => client.delete(`/records/${id}/star/`)

export const getVersions = (recordId: string) => client.get(`/records/${recordId}/versions/`)

export const uploadVersion = (recordId: string, formData: FormData) =>
  client.post(`/records/${recordId}/versions/upload/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const getVersionDiff = (recordId: string, v1: string, v2: string) =>
  client.get(`/records/${recordId}/versions/diff/`, { params: { v1, v2 } })

export const getVersionPreviewUrl = (recordId: string, versionId: string) =>
  client.get(`/records/${recordId}/versions/${versionId}/preview-url/`)

export const generateQR = (recordId: string) => client.post(`/records/${recordId}/qr-code/`)

export const getRecordPermissions = (recordId: string) =>
  client.get(`/records/${recordId}/permissions/`)

export const setRecordPermission = (recordId: string, data: Record<string, unknown>) =>
  client.post(`/records/${recordId}/permissions/`, data)

export const getRecordSeries = () => client.get('/records/series/')

export const downloadVersion = (recordId: string, versionId: string, inline = false) =>
  client.get(`/records/${recordId}/versions/${versionId}/download/`, {
    params: inline ? { inline: 1 } : {},
    responseType: 'blob',
  })

export const getRecordAudit = (recordId: string) => client.get(`/records/${recordId}/audit/`)

export const bulkUpdateRecords = (data: Record<string, unknown>) =>
  client.post('/records/bulk/', data)

export const deleteRecordPermission = (recordId: string, permId: string) =>
  client.delete(`/records/${recordId}/permissions/${permId}/`)
