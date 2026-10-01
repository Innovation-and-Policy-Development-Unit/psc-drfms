import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import CommandPalette from './CommandPalette'
import DriveDropZone from '../drive/DriveDropZone'
import { DriveStatusBar } from '../drive/DriveStatusBar'
import { TransferPanel } from '../drive/TransferPanel'
import MegaUploadDialog from '../drive/MegaUploadDialog'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { DriveUIProvider, useDriveUI } from '@/context/DriveUIContext'
import { TransferProvider } from '@/context/TransferContext'

function AppShellInner() {
  const [mobileNav, setMobileNav] = useState(false)
  const { uploadDialogOpen, closeUploadDialog, pendingDialogFiles } = useDriveUI()

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
      <Header onMenuClick={() => setMobileNav((o) => !o)} />

      <main className="fixed inset-x-0 bottom-0 top-16 lg:start-64 flex flex-col min-w-0">
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
      <SettingsPanel />
      <CommandPalette />
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
