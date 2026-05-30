import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import DriveSidebar from '../drive/DriveSidebar'
import DriveTopBar from '../drive/DriveTopBar'
import DriveDropZone from '../drive/DriveDropZone'
import { DriveStatusBar } from '../drive/DriveStatusBar'
import { TransferPanel } from '../drive/TransferPanel'
import MegaUploadDialog from '../drive/MegaUploadDialog'
import { SettingsPanel } from '@/components/layout/SettingsPanel'
import { DriveUIProvider, useDriveUI } from '@/context/DriveUIContext'
import { TransferProvider } from '@/context/TransferContext'
import clsx from 'clsx'

function DriveLayoutInner() {
  const [mobileNav, setMobileNav] = useState(false)
  const { uploadDialogOpen, closeUploadDialog, pendingDialogFiles } = useDriveUI()

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--surface-base)' }}>
      <DriveTopBar
        onMenuClick={() => setMobileNav((o) => !o)}
        onSearch={() => setMobileNav(false)}
      />

      <div className="drive-shell relative">
        {mobileNav && (
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileNav(false)} />
        )}

        <div
          className={clsx(
            'fixed lg:static inset-y-0 start-0 z-50 lg:z-auto pt-14 lg:pt-0 h-full transition-transform duration-200 lg:translate-x-0',
            mobileNav ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:translate-x-0',
          )}
        >
          <DriveSidebar onNavigate={() => setMobileNav(false)} />
        </div>

        <DriveDropZone enabled>
          <div className="drive-main">
            <div className="drive-main-scroll">
              <Outlet />
            </div>
            <TransferPanel />
            <DriveStatusBar />
          </div>
        </DriveDropZone>
      </div>

      <MegaUploadDialog
        open={uploadDialogOpen}
        onClose={closeUploadDialog}
        initialFiles={pendingDialogFiles}
      />
      <SettingsPanel />
    </div>
  )
}

export default function DriveLayout() {
  return (
    <DriveUIProvider>
      <TransferProvider>
        <DriveLayoutInner />
      </TransferProvider>
    </DriveUIProvider>
  )
}
