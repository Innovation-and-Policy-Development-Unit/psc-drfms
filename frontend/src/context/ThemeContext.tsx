import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'

interface ThemeContextValue {
  isDark: boolean
  toggleDark: () => void
  settingsPanelOpen: boolean
  openSettingsPanel: () => void
  closeSettingsPanel: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('psc-dark')
    return saved ? JSON.parse(saved) as boolean : false
  })
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('psc-dark', JSON.stringify(isDark))
  }, [isDark])

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        toggleDark: () => setIsDark((p) => !p),
        settingsPanelOpen,
        openSettingsPanel: () => setSettingsPanelOpen(true),
        closeSettingsPanel: () => setSettingsPanelOpen(false),
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
