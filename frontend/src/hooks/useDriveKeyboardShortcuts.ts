import { useEffect, useCallback, type RefObject } from 'react'

export interface DriveKeyboardActions {
  selectAll: () => void
  clearSelection: () => void
  openFocused: () => void
  toggleFocusedSelect: () => void
  deleteSelected: () => void
  moveFocus: (delta: number) => void
  focusFirst: () => void
  focusLast: () => void
  toggleInfoPane: () => void
  refresh?: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return !!target.closest('[contenteditable="true"], .onlyoffice-editor, #oo-editor-container')
}

function isMac() {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

export function useDriveKeyboardShortcuts(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  actions: DriveKeyboardActions,
  focusSearch: () => void,
) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return
      if (isEditableTarget(e.target)) return

      const mod = isMac() ? e.metaKey : e.ctrlKey

      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        actions.selectAll()
        return
      }

      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        focusSearch()
        return
      }

      if (e.key === '/' && !mod && !e.altKey) {
        e.preventDefault()
        focusSearch()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        actions.clearSelection()
        return
      }

      if (e.key === 'Delete' || (e.key === 'Backspace' && !isEditableTarget(document.activeElement))) {
        if (isEditableTarget(e.target)) return
        e.preventDefault()
        actions.deleteSelected()
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        actions.openFocused()
        return
      }

      if (e.key === ' ' && !mod) {
        e.preventDefault()
        actions.toggleFocusedSelect()
        return
      }

      if (e.key === 'i' || e.key === 'I') {
        if (mod || e.altKey) return
        e.preventDefault()
        actions.toggleInfoPane()
        return
      }

      if (e.key === 'F5') {
        e.preventDefault()
        actions.refresh?.()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        actions.moveFocus(1)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        actions.moveFocus(-1)
        return
      }

      if (e.key === 'Home') {
        e.preventDefault()
        actions.focusFirst()
        return
      }

      if (e.key === 'End') {
        e.preventDefault()
        actions.focusLast()
        return
      }
    },
    [enabled, actions, focusSearch],
  )

  useEffect(() => {
    const node = containerRef.current ?? document
    node.addEventListener('keydown', handler as EventListener)
    return () => node.removeEventListener('keydown', handler as EventListener)
  }, [containerRef, handler])
}
