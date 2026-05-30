import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { UploadCloud } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useDriveUI } from '@/context/DriveUIContext'
import clsx from 'clsx'

const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']

interface DriveDropZoneProps {
  children: ReactNode
  enabled?: boolean
}

export default function DriveDropZone({ children, enabled = true }: DriveDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const { openUploadDialog } = useDriveUI()
  const { user } = useAuth()
  const canUpload = OFFICER.includes(user?.role ?? '')

  const onDragEnter = useCallback((e: DragEvent) => {
    if (!enabled || !canUpload) return
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault()
      setDragging(true)
    }
  }, [enabled, canUpload])

  const onDragLeave = useCallback((e: DragEvent) => {
    if (!enabled) return
    if (e.relatedTarget === null || !document.body.contains(e.relatedTarget as Node)) {
      setDragging(false)
    }
  }, [enabled])

  const onDragOver = useCallback((e: DragEvent) => {
    if (!enabled || !canUpload) return
    e.preventDefault()
  }, [enabled, canUpload])

  const onDrop = useCallback((e: DragEvent) => {
    if (!enabled || !canUpload) return
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer?.files ?? [])
    if (dropped.length) openUploadDialog(dropped)
  }, [enabled, canUpload, openUploadDialog])

  useEffect(() => {
    if (!enabled || !canUpload) return
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [enabled, canUpload, onDragEnter, onDragLeave, onDragOver, onDrop])

  return (
    <>
      {children}
      <div className={clsx('drive-drop-overlay', dragging && 'visible')} aria-hidden={!dragging}>
        <div className="drive-drop-panel">
          <UploadCloud size={40} className="mx-auto mb-3 mega-upload-cloud" />
          <p className="font-medium text-[var(--text-primary)]">Drop files to upload</p>
          <p className="text-sm text-muted mt-1">Release to add files to the upload queue</p>
        </div>
      </div>
    </>
  )
}
