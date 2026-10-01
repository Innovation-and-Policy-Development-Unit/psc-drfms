import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import {
  Search, FileText, CornerDownLeft, Upload, Moon, Sun, ArrowRight, Loader2,
  type LucideIcon,
} from 'lucide-react'
import { searchApi, type SearchSuggestion } from '@/api'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useDriveUI } from '@/context/DriveUIContext'
import menuItems from '@/data/menuItems'
import { DOC_TYPE_LABELS } from '@/lib/recordBadges'

const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']

interface Item {
  id: string
  group: 'Records' | 'Go to' | 'Actions'
  label: string
  hint?: string
  icon: LucideIcon
  run: () => void
}

/** Open from anywhere with the `open-command-palette` window event. */
export const OPEN_PALETTE_EVENT = 'open-command-palette'

export default function CommandPalette() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isDark, toggleDark } = useTheme()
  const { openUploadDialog } = useDriveUI()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [records, setRecords] = useState<SearchSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const role = user?.role ?? 'read_only'
  const canUpload = OFFICER.includes(role)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setRecords([])
  }, [])

  // Global shortcuts: Ctrl/⌘+K anywhere, "/" when not typing in a field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  // Live record lookup, debounced; stale requests are aborted
  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < 2) {
      setRecords([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      searchApi.suggest(q, ctrl.signal)
        .then(({ data }) => setRecords(data))
        .catch(() => { /* aborted or offline: keep the list as is */ })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })
    }, 120)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [query, open])

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const out: Item[] = []

    records.forEach((r) => out.push({
      id: `rec-${r.id}`,
      group: 'Records',
      label: r.title,
      hint: `${r.referenceNumber} · ${DOC_TYPE_LABELS[r.documentType] ?? r.documentType}`,
      icon: FileText,
      run: () => navigate(`/document/${r.id}`),
    }))

    if (q.length >= 2) {
      out.push({
        id: 'search-all',
        group: 'Actions',
        label: `Search all records for “${query.trim()}”`,
        hint: 'Filters, facets, full text',
        icon: Search,
        run: () => navigate(`/search?q=${encodeURIComponent(query.trim())}`),
      })
    }

    menuItems
      .filter((g) => !g.roles || g.roles.includes(role))
      .forEach((g) =>
        g.items
          .filter((i) => !i.roles || i.roles.includes(role))
          .forEach((i) => {
            if (!i.path) return
            if (q && !`${i.label} ${g.group}`.toLowerCase().includes(q)) return
            out.push({
              id: `nav-${i.path}`,
              group: 'Go to',
              label: i.label,
              hint: g.group,
              icon: i.icon,
              run: () => navigate(i.path as string),
            })
          }),
      )

    const actions: Item[] = []
    if (canUpload) {
      actions.push({ id: 'act-upload', group: 'Actions', label: 'Upload documents', icon: Upload, run: () => openUploadDialog() })
    }
    actions.push({
      id: 'act-theme',
      group: 'Actions',
      label: isDark ? 'Switch to light mode' : 'Switch to dark mode',
      icon: isDark ? Sun : Moon,
      run: toggleDark,
    })
    out.push(...actions.filter((a) => !q || a.label.toLowerCase().includes(q)))

    return out
  }, [query, records, role, canUpload, isDark, navigate, openUploadDialog, toggleDark])

  useEffect(() => { setActive(0) }, [query, records.length])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (item?: Item) => {
    if (!item) return
    close()
    item.run()
  }

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
  }

  if (!open) return null

  let lastGroup = ''
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm animate-fade-in" onClick={close} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-lg animate-scale-in dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800">
          {loading ? <Loader2 size={18} className="animate-spin text-primary-500" /> : <Search size={18} className="text-gray-400" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search records, jump to a page, run an action…"
            className="h-14 w-full bg-transparent text-base text-gray-900 placeholder:text-gray-400 focus:outline-none dark:text-white"
            aria-label="Command palette search"
          />
          <kbd className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:block dark:border-gray-700">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2 custom-scrollbar">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-gray-400">
              {loading ? 'Searching…' : `No matches for “${query.trim()}”`}
            </p>
          ) : (
            items.map((item, idx) => {
              const header = item.group !== lastGroup
              lastGroup = item.group
              const Icon = item.icon
              return (
                <div key={item.id}>
                  {header && (
                    <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.group}</p>
                  )}
                  <button
                    type="button"
                    data-idx={idx}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => choose(item)}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors',
                      idx === active
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300',
                    )}
                  >
                    <span className={clsx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      idx === active ? 'bg-white text-primary-500 dark:bg-gray-900' : 'bg-gray-100 text-gray-500 dark:bg-white/5',
                    )}>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      {item.hint && <span className="block truncate text-xs text-gray-400">{item.hint}</span>}
                    </span>
                    {idx === active && <CornerDownLeft size={14} className="shrink-0 text-gray-400" />}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 dark:border-gray-800">
          <span className="flex items-center gap-3">
            <span><kbd className="font-sans">↑↓</kbd> navigate</span>
            <span><kbd className="font-sans">↵</kbd> open</span>
          </span>
          <span className="flex items-center gap-1">Press <kbd className="font-sans">/</kbd> or <kbd className="font-sans">Ctrl K</kbd> anywhere <ArrowRight size={11} /></span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
