import client from './client'

export const getRecords = (params) => client.get('/records/', { params })
export const getRecord = (id) => client.get(`/records/${id}/`)
export const createRecord = (formData) => client.post('/records/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const updateRecord = (id, data) => client.patch(`/records/${id}/`, data)
export const deleteRecord = (id) => client.delete(`/records/${id}/`)

export const starRecord = (id) => client.post(`/records/${id}/star/`)
export const unstarRecord = (id) => client.delete(`/records/${id}/star/`)

export const getVersions = (recordId) => client.get(`/records/${recordId}/versions/`)
export const uploadVersion = (recordId, formData) => client.post(`/records/${recordId}/versions/upload/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getVersionDiff = (recordId, v1, v2) => client.get(`/records/${recordId}/versions/diff/`, { params: { v1, v2 } })
export const getVersionPreviewUrl = (recordId, versionId) =>
  client.get(`/records/${recordId}/versions/${versionId}/preview-url/`)

export const generateQR = (recordId) => client.post(`/records/${recordId}/qr-code/`)
export const getRecordPermissions = (recordId) => client.get(`/records/${recordId}/permissions/`)
export const setRecordPermission = (recordId, data) => client.post(`/records/${recordId}/permissions/`, data)

export const getRecordSeries = () => client.get('/records/series/')

export const downloadVersion = (recordId, versionId, inline = false) =>
  client.get(`/records/${recordId}/versions/${versionId}/download/`, {
    params: inline ? { inline: 1 } : {},
    responseType: 'blob',
  })

export const getRecordAudit = (recordId) => client.get(`/records/${recordId}/audit/`)

export const bulkUpdateRecords = (data) => client.post('/records/bulk/', data)

export const deleteRecordPermission = (recordId, permId) =>
  client.delete(`/records/${recordId}/permissions/${permId}/`)
