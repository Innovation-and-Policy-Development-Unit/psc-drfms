import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import HorizontalMenu from './HorizontalMenu'
import SettingsPanel from './SettingsPanel'

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header onMenuClick={() => setMobileMenuOpen(o => !o)} />
      <HorizontalMenu
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <main className="min-h-screen mt-16 lg:mt-28 transition-all duration-300">
        <div className="p-4 sm:p-6 max-w-screen-2xl mx-auto">
          <Outlet />
        </div>
      </main>
      <SettingsPanel />
    </div>
  )
}
