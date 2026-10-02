import client from './client'
import type { Prefs } from '@/lib/themes'

export interface OrgAppearance extends Prefs {
  locked: boolean
}

export const appearanceApi = {
  get: () => client.get<{ org: OrgAppearance; user: Partial<Prefs> }>('/appearance/'),
  saveMine: (prefs: Partial<Prefs>) => client.put<Partial<Prefs>>('/appearance/me/', prefs),
  resetMine: () => client.delete('/appearance/me/'),
  saveOrg: (prefs: Partial<OrgAppearance>) => client.put<OrgAppearance>('/appearance/org/', prefs),
}
