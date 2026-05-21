import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import DriveSidebar from '../drive/DriveSidebar'
import DriveTopBar from '../drive/DriveTopBar'
import SettingsPanel from './SettingsPanel'
import clsx from 'clsx'

export default function DriveLayout() {
  const [mobileNav, setMobileNav] = useState(false)
  const location = useLocation()
  const isDocumentView = location.pathname.startsWith('/document/')

  return (
    <div className="h-screen flex flex-col bg-[#f3f2f1] dark:bg-slate-950 overflow-hidden">
      <DriveTopBar onMenuClick={() => setMobileNav(o => !o)} onSearch={() => setMobileNav(false)} />

      <div className="flex flex-1 min-h-0 relative">
        {mobileNav && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileNav(false)}
          />
        )}

        <div
          className={clsx(
            'fixed lg:static inset-y-0 start-0 z-50 lg:z-auto pt-12 lg:pt-0 h-full transition-transform duration-200 lg:translate-x-0',
            mobileNav ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0'
          )}
        >
          <DriveSidebar onNavigate={() => setMobileNav(false)} />
        </div>

        <main
          className={clsx(
            'flex-1 min-w-0 overflow-auto',
            isDocumentView ? 'p-0' : 'p-4 sm:p-6'
          )}
        >
          {!isDocumentView && (
            <div className="max-w-[1600px] mx-auto h-full">
              <Outlet />
            </div>
          )}
          {isDocumentView && <Outlet />}
        </main>
      </div>

      <SettingsPanel />
    </div>
  )
}
