import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_PREFS, applyAppearance, type Mode, type Prefs } from '@/lib/themes'
import type { OrgAppearance } from '@/api/appearance'

const STORAGE_KEY = 'psc-appearance'
const LEGACY_DARK_KEY = 'psc-dark'

interface ThemeContextValue {
  /** The look actually shown: the organisation's if locked, else personal over org default. */
  prefs: Prefs
  isDark: boolean
  /** True when an administrator has fixed the look for everyone. */
  locked: boolean
  org: OrgAppearance | null
  personal: Partial<Prefs>
  /** True once the server's settings have been loaded (safe to sync upwards). */
  hydrated: boolean
  setPref: (patch: Partial<Prefs>) => void
  resetPersonal: () => void
  hydrate: (org: OrgAppearance, user: Partial<Prefs>) => void
  setOrg: (org: OrgAppearance) => void
  toggleDark: () => void
  settingsPanelOpen: boolean
  openSettingsPanel: () => void
  closeSettingsPanel: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function loadPersonal(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Partial<Prefs>
    const legacy = localStorage.getItem(LEGACY_DARK_KEY)
    if (legacy) return { mode: JSON.parse(legacy) ? 'dark' : 'light' }
  } catch {
    /* unreadable storage: start with defaults */
  }
  return {}
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [personal, setPersonal] = useState<Partial<Prefs>>(loadPersonal)
  const [org, setOrgState] = useState<OrgAppearance | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  const locked = !!org?.locked

  const prefs = useMemo<Prefs>(() => {
    const base = { ...DEFAULT_PREFS, ...(org ? { theme: org.theme, mode: org.mode, density: org.density, radius: org.radius } : {}) }
    return locked ? base : { ...base, ...personal }
  }, [org, personal, locked])

  const isDark = prefs.mode === 'dark' || (prefs.mode === 'system' && systemDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyAppearance(prefs, isDark)
  }, [prefs, isDark])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(personal))
      localStorage.removeItem(LEGACY_DARK_KEY)
    } catch {
      /* storage blocked: the choice still applies for this session */
    }
  }, [personal])

  const setPref = useCallback((patch: Partial<Prefs>) => {
    if (locked) return
    setPersonal((p) => ({ ...p, ...patch }))
  }, [locked])

  const resetPersonal = useCallback(() => setPersonal({}), [])

  const hydrate = useCallback((nextOrg: OrgAppearance, user: Partial<Prefs>) => {
    setOrgState(nextOrg)
    // The server copy wins on load so a choice follows the person across devices
    if (user && Object.keys(user).length) setPersonal(user)
    setHydrated(true)
  }, [])

  const toggleDark = useCallback(() => {
    if (locked) return
    setPersonal((p) => ({ ...p, mode: (p.mode ?? prefs.mode) === 'dark' || isDark ? 'light' : 'dark' }))
  }, [locked, prefs.mode, isDark])

  const value = useMemo<ThemeContextValue>(() => ({
    prefs,
    isDark,
    locked,
    org,
    personal,
    hydrated,
    setPref,
    resetPersonal,
    hydrate,
    setOrg: setOrgState,
    toggleDark,
    settingsPanelOpen,
    openSettingsPanel: () => setSettingsPanelOpen(true),
    closeSettingsPanel: () => setSettingsPanelOpen(false),
  }), [prefs, isDark, locked, org, personal, hydrated, setPref, resetPersonal, hydrate, toggleDark, settingsPanelOpen])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

export type { Mode }
