import client from './client'

export type BackupFrequency = 'daily' | 'weekly'
export type RunStatus = 'running' | 'success' | 'failed'

export interface BackupRun {
  id: string
  status: RunStatus
  trigger: 'scheduled' | 'manual'
  triggeredByName: string
  startedAt: string
  finishedAt: string | null
  databaseFile: string
  databaseBytes: number
  filesCopied: number
  filesSkipped: number
  filesBytes: number
  error: string
}

export interface BackupSettings {
  enabled: boolean
  server: string
  share: string
  folder: string
  domain: string
  username: string
  hasPassword: boolean
  frequency: BackupFrequency
  runHour: number
  weekday: number
  keepDatabaseCopies: number
  configured: boolean
  nextRun: string | null
  lastRun: BackupRun | null
  running: boolean
}

export type BackupSettingsInput = Partial<Omit<BackupSettings, 'hasPassword' | 'configured' | 'nextRun' | 'lastRun' | 'running'>> & {
  password?: string
}

export const backupsApi = {
  getSettings: () => client.get<BackupSettings>('/backups/settings/'),
  saveSettings: (data: BackupSettingsInput) => client.put<BackupSettings>('/backups/settings/', data),
  test: (data: BackupSettingsInput) => client.post<{ ok: boolean; message: string }>('/backups/test/', data),
  runNow: () => client.post<BackupRun>('/backups/runs/'),
  runs: () => client.get<BackupRun[]>('/backups/runs/'),
}
