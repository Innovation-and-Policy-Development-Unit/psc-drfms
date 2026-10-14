import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from './CommandPalette'
import AppearanceSync from './AppearanceSync'
import DriveDropZone from '../drive/DriveDropZone'
import { DriveStatusBar } from '../drive/DriveStatusBar'
import { TransferPanel } from '../drive/TransferPanel'
import { UndoHost } from '../drive/UndoHost'
import MegaUploadDialog from '../drive/MegaUploadDialog'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { DriveUIProvider, useDriveUI } from '@/context/DriveUIContext'
import { TransferProvider } from '@/context/TransferContext'

function AppShellInner() {
  const [mobileNav, setMobileNav] = useState(false)
  // Desktop icon-rail sidebar; remembered per browser
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("psc-sidebar-collapsed") === "1" } catch { return false }
  })
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem("psc-sidebar-collapsed", c ? "0" : "1") } catch { /* storage blocked: applies for this visit */ }
    return !c
  })
  const { uploadDialogOpen, closeUploadDialog, pendingDialogFiles } = useDriveUI()

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} collapsed={collapsed} />
      <Header onMenuClick={() => setMobileNav((o) => !o)} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />

      <main className={`fixed inset-x-0 bottom-0 top-16 flex flex-col min-w-0 transition-[inset] duration-300 ${collapsed ? "lg:start-[5.5rem]" : "lg:start-64"}`}>
        <DriveDropZone enabled>
          <div className="drive-main !bg-transparent">
            <div className="drive-main-scroll">
              <Outlet />
            </div>
            <TransferPanel />
            <DriveStatusBar />
          </div>
        </DriveDropZone>
      </main>

      <MegaUploadDialog
        open={uploadDialogOpen}
        onClose={closeUploadDialog}
        initialFiles={pendingDialogFiles}
      />
      <UndoHost />
      <SettingsPanel />
      <CommandPalette />
      <AppearanceSync />
    </div>
  )
}

export default function DriveLayout() {
  return (
    <DriveUIProvider>
      <TransferProvider>
        <AppShellInner />
      </TransferProvider>
    </DriveUIProvider>
  )
}
