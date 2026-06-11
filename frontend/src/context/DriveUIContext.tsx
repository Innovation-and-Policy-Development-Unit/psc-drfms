import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'

export type DriveViewMode = 'list' | 'grid'

interface DriveUIContextValue {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  viewMode: DriveViewMode
  setViewMode: (mode: DriveViewMode) => void
  setPendingUploadFile: (file: File) => void
  consumePendingUploadFile: () => File | null
  statusMessage: string
  setStatusMessage: (msg: string) => void
  uploadDialogOpen: boolean
  openUploadDialog: (files?: File[]) => void
  closeUploadDialog: () => void
  pendingDialogFiles: File[]
  infoPaneOpen: boolean
  setInfoPaneOpen: (v: boolean) => void
  toggleInfoPane: () => void
  searchInputRef: RefObject<HTMLInputElement | null>
  focusSearch: () => void
}

const DriveUIContext = createContext<DriveUIContextValue | null>(null)

const VIEW_KEY = 'drive-view-mode'
const SIDEBAR_KEY = 'drive-sidebar-collapsed'
const INFO_PANE_KEY = 'drive-info-pane-open'

export function DriveUIProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() =>
    localStorage.getItem(SIDEBAR_KEY) === '1',
  )
  const [viewMode, setViewModeState] = useState<DriveViewMode>(() =>
    (localStorage.getItem(VIEW_KEY) as DriveViewMode) || 'list',
  )
  const [infoPaneOpen, setInfoPaneOpenState] = useState(() =>
    localStorage.getItem(INFO_PANE_KEY) !== '0',
  )
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [pendingDialogFiles, setPendingDialogFiles] = useState<File[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    localStorage.setItem(INFO_PANE_KEY, infoPaneOpen ? '1' : '0')
  }, [infoPaneOpen])

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedState(v)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((c) => !c)
  }, [])

  const setViewMode = useCallback((mode: DriveViewMode) => {
    setViewModeState(mode)
    localStorage.setItem(VIEW_KEY, mode)
  }, [])

  const setInfoPaneOpen = useCallback((v: boolean) => {
    setInfoPaneOpenState(v)
  }, [])

  const toggleInfoPane = useCallback(() => {
    setInfoPaneOpenState((o) => !o)
  }, [])

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [])

  const setPendingUploadFile = useCallback((file: File) => {
    setPendingFile(file)
  }, [])

  const consumePendingUploadFile = useCallback(() => {
    const f = pendingFile
    setPendingFile(null)
    return f
  }, [pendingFile])

  const openUploadDialog = useCallback((files?: File[]) => {
    setPendingDialogFiles(files ?? [])
    setUploadDialogOpen(true)
  }, [])

  const closeUploadDialog = useCallback(() => {
    setUploadDialogOpen(false)
    setPendingDialogFiles([])
  }, [])

  return (
    <DriveUIContext.Provider
      value={{
        sidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        viewMode,
        setViewMode,
        setPendingUploadFile,
        consumePendingUploadFile,
        statusMessage,
        setStatusMessage,
        uploadDialogOpen,
        openUploadDialog,
        closeUploadDialog,
        pendingDialogFiles,
        infoPaneOpen,
        setInfoPaneOpen,
        toggleInfoPane,
        searchInputRef,
        focusSearch,
      }}
    >
      {children}
    </DriveUIContext.Provider>
  )
}

export function useDriveUI() {
  const ctx = useContext(DriveUIContext)
  if (!ctx) throw new Error('useDriveUI must be used within DriveUIProvider')
  return ctx
}
