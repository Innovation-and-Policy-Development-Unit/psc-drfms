import { createContext, useContext, useState, useEffect } from 'react'
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('liner-dark')
    return saved ? JSON.parse(saved) : false
  })

  const [isRTL, setIsRTL] = useState(() => {
    const saved = localStorage.getItem('liner-rtl')
    return saved ? JSON.parse(saved) : false
  })

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('liner-sidebar-collapsed')
    return saved ? JSON.parse(saved) : false
  })

  const [isHorizontal, setIsHorizontal] = useState(() => {
    const saved = localStorage.getItem('liner-horizontal')
    return saved ? JSON.parse(saved) : true
  })

  const [colorPreset, setColorPreset] = useState(() => {
    return localStorage.getItem('liner-color-preset') || 'navy'
  })

  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)

  // Apply dark mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('liner-dark', JSON.stringify(isDark))
  }, [isDark])

  // Apply RTL
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    localStorage.setItem('liner-rtl', JSON.stringify(isRTL))
  }, [isRTL])

  // Apply color preset
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorPreset)
    localStorage.setItem('liner-color-preset', colorPreset)
  }, [colorPreset])

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('liner-sidebar-collapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Persist horizontal state
  useEffect(() => {
    localStorage.setItem('liner-horizontal', JSON.stringify(isHorizontal))
  }, [isHorizontal])

  const toggleDark = () => setIsDark(prev => !prev)
  const toggleRTL = () => setIsRTL(prev => !prev)
  const toggleSidebar = () => setSidebarCollapsed(prev => !prev)
  const toggleHorizontal = () => setIsHorizontal(prev => !prev)
  const openSettingsPanel = () => setSettingsPanelOpen(true)
  const closeSettingsPanel = () => setSettingsPanelOpen(false)

  return (
    <ThemeContext.Provider value={{
      isDark,
      isRTL,
      sidebarCollapsed,
      isHorizontal,
      colorPreset,
      settingsPanelOpen,
      toggleDark,
      toggleRTL,
      toggleSidebar,
      toggleHorizontal,
      setColorPreset,
      openSettingsPanel,
      closeSettingsPanel,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
