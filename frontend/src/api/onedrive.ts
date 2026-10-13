import client from './client'

export interface OneDriveSettings {
  enabled: boolean
  clientId: string
  tenantId: string
  updatedAt: string
}

export const onedriveApi = {
  get: () => client.get<OneDriveSettings>('/integrations/onedrive/'),
  save: (data: Partial<Pick<OneDriveSettings, 'enabled' | 'clientId' | 'tenantId'>>) =>
    client.put<OneDriveSettings>('/integrations/onedrive/', data),
}
