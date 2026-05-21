import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import Sidebar from './Sidebar'
import Header from './Header'
import HorizontalMenu from './HorizontalMenu'
import SettingsPanel from './SettingsPanel'
import clsx from 'clsx'

export default function Layout() {
  const { sidebarCollapsed, isHorizontal, toggleSidebar } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleMenuClick = () => {
    if (window.innerWidth < 1024) {
      setMobileMenuOpen(o => !o)
    } else if (!isHorizontal) {
      toggleSidebar()
    }
  }

  const mainMargin = isHorizontal
    ? 'lg:ms-0'
    : sidebarCollapsed
      ? 'lg:ms-[5.5rem]'
      : 'lg:ms-64'

  const mainTopOffset = isHorizontal ? 'mt-16 lg:mt-28' : 'mt-16'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {!isHorizontal && (
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
      )}
      <Header onMenuClick={handleMenuClick} />
      {isHorizontal && (
        <HorizontalMenu
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
      )}
      <main className={clsx('min-h-screen transition-all duration-300', mainMargin, mainTopOffset)}>
        <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>
      <SettingsPanel />
    </div>
  )
}
