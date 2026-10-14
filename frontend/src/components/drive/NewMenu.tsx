import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, FileSpreadsheet, FileText, FolderPlus, FolderUp, Plus, Presentation, Upload } from 'lucide-react'
import clsx from 'clsx'
import { useDriveUI } from '@/context/DriveUIContext'
import type { NewDocumentKind } from '@/api/drive'
import NewDocumentDialog from './NewDocumentDialog'
import NewFolderDialog from './NewFolderDialog'

interface Props {
  /** Series to file a new document under; defaults to the series currently being browsed. */
  recordSeries?: string | null
  compact?: boolean
  className?: string
}

const DOCS: Array<{ kind: NewDocumentKind; label: string; Icon: typeof FileText; tone: string }> = [
  { kind: 'word', label: 'Word document', Icon: FileText, tone: 'text-blue-600' },
  { kind: 'excel', label: 'Excel workbook', Icon: FileSpreadsheet, tone: 'text-emerald-600' },
  { kind: 'powerpoint', label: 'PowerPoint presentation', Icon: Presentation, tone: 'text-orange-600' },
]

/** "New" button: upload files or a folder, or start a blank Office document in the editor. */
export default function NewMenu({ recordSeries, compact = false, className }: Props) {
  const { openUploadDialog } = useDriveUI()
  const [params] = useSearchParams()
  const series = recordSeries ?? params.get('record_series')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState<NewDocumentKind | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const onFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => !f.name.startsWith('.'))
    e.target.value = ''
    if (files.length) openUploadDialog(files)
  }

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full bg-primary-500 font-medium text-white shadow-theme-xs transition-colors hover:bg-primary-600',
          compact ? 'h-8 px-3.5 text-xs' : 'h-10 px-4 text-sm',
        )}
      >
        <Plus size={compact ? 14 : 16} /> New <ChevronDown size={13} className="opacity-70" />
      </button>

      {open && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-64 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] py-1 text-sm shadow-lg">
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-[var(--surface-sunken)]"
            onClick={() => { setOpen(false); setCreatingFolder(true) }}>
            <FolderPlus size={16} className="shrink-0 text-amber-500" /> Folder
          </button>
          <div className="my-1 border-t border-[var(--border-default)]" />
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-[var(--surface-sunken)]"
            onClick={() => { setOpen(false); openUploadDialog() }}>
            <Upload size={16} className="shrink-0 text-muted" /> Upload files
          </button>
          <button type="button" role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-[var(--surface-sunken)]"
            onClick={() => { setOpen(false); folderInput.current?.click() }}>
            <FolderUp size={16} className="shrink-0 text-muted" /> Upload folder
          </button>
          <div className="my-1 border-t border-[var(--border-default)]" />
          {DOCS.map(({ kind, label, Icon, tone }) => (
            <button key={kind} type="button" role="menuitem" className="flex w-full items-center gap-2.5 px-3 py-2 text-start hover:bg-[var(--surface-sunken)]"
              onClick={() => { setOpen(false); setCreating(kind) }}>
              <Icon size={16} className={clsx('shrink-0', tone)} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* webkitdirectory is non-standard, so it is set on the element rather than in JSX types */}
      <input
        ref={(el) => { folderInput.current = el; el?.setAttribute('webkitdirectory', '') }}
        type="file"
        multiple
        className="hidden"
        onChange={onFolderPicked}
        aria-hidden
        tabIndex={-1}
      />

      {creatingFolder && <NewFolderDialog parent={series} onClose={() => setCreatingFolder(false)} />}
      {creating && <NewDocumentDialog kind={creating} recordSeries={series} onClose={() => setCreating(null)} />}
    </div>
  )
}
