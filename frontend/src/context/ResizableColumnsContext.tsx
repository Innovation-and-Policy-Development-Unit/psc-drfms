import { createContext, useContext, type ReactNode } from 'react'
import { useResizableColumns } from '@/hooks/useResizableColumns'

type ResizableColumnsContextValue = ReturnType<typeof useResizableColumns>

const ResizableColumnsContext = createContext<ResizableColumnsContextValue | null>(null)

export function ResizableColumnsProvider({ children }: { children: ReactNode }) {
  const value = useResizableColumns()
  return (
    <ResizableColumnsContext.Provider value={value}>
      {children}
    </ResizableColumnsContext.Provider>
  )
}

export function useDriveListColumns() {
  const ctx = useContext(ResizableColumnsContext)
  if (!ctx) throw new Error('useDriveListColumns requires ResizableColumnsProvider')
  return ctx
}
