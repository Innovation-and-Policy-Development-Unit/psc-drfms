import { memo, useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import clsx from 'clsx'
import { useRecords } from '@/hooks/useRecords'
import { useAuth } from '@/context/AuthContext'
import { useDriveUI } from '@/context/DriveUIContext'
import { ResizableColumnsProvider } from '@/context/ResizableColumnsContext'
import { RecordRow } from '@/components/documents/RecordRow'
import { RecordGridCard } from '@/components/documents/RecordGridCard'
import { DriveToolbar } from '@/components/drive/DriveToolbar'
import { ResizableDriveListHeader } from '@/components/drive/ResizableDriveList'
import { ContextMenu } from '@/components/drive/ContextMenu'
import { SelectionBar } from '@/components/drive/SelectionBar'
import { DetailsPane } from '@/components/drive/DetailsPane'
import { ViewSortMenu, SORT_FIELDS } from '@/components/drive/ViewSortMenu'
import { PinButton } from '@/components/drive/PinButton'
import MoveDialog from '@/components/drive/MoveDialog'
import ShareDialog from '@/components/record/ShareDialog'
import { Button } from '@/components/ui/Button'
import { ConfirmPopover, anchorFromEvent, type ConfirmAnchor } from '@/components/ui/ConfirmPopover'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  buildRecordContextMenuItems,
  copyRecordLink,
  recordAbsoluteUrl,
  recordDetailPath,
} from '@/lib/driveRecordActions'
import * as recordsApi from '@/api/records'
import { useTransfers } from '@/context/TransferContext'
import type { BreadcrumbItem, RecordListItem } from '@/types/api'

/** URL parameters the list passes straight to the records API. */
const PASS_THROUGH = [
  'record_series', 'document_type', 'tag', 'originating_ministry', 'custodian',
  'classification_level', 'year', 'file_type',
] as const

function useWideScreen() {
  const query = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

interface FileBrowserProps {
  title?: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  defaultOrdering?: string
  pageSize?: number
  enableBulk?: boolean
  filterParams?: Record<string, string | boolean>
  driveMode?: boolean
  /** Rendered between the toolbar and the list (e.g. series folders and type chips). */
  header?: ReactNode
}

function FileBrowserInner({
  title,
  subtitle,
  breadcrumbs = [],
  defaultOrdering = '-updated_at',
  pageSize = 25,
  enableBulk = true,
  filterParams = {},
  driveMode = true,
  header,
}: FileBrowserProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; record: RecordListItem } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ records: RecordListItem[]; anchor: ConfirmAnchor } | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [moving, setMoving] = useState<string[] | null>(null)
  const [sharing, setSharing] = useState<RecordListItem | null>(null)
  const { user } = useAuth()
  const { viewMode, setStatusMessage, infoPaneOpen, setInfoPaneOpen } = useDriveUI()
  const { queueDownload } = useTransfers()
  const wide = useWideScreen()

  const canDelete = ['records_officer', 'director', 'commissioner', 'administrator']
    .includes(user?.role ?? '')

  const page = parseInt(searchParams.get('page') || '1', 10)
  const ordering = searchParams.get('ordering') || defaultOrdering

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = { page, page_size: pageSize, ordering }
    if (!filterParams.starred && !filterParams.shared_with_me) {
      PASS_THROUGH.forEach((key) => {
        const value = searchParams.get(key)
        if (value) params[key] = value
      })
    }
    Object.entries(filterParams).forEach(([k, v]) => { if (v) params[k] = v })
    return params
  }, [page, ordering, pageSize, searchParams, filterParams])

  const { records, count, loading, refresh } = useRecords(queryParams)
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const paneOpen = driveMode && infoPaneOpen && wide

  useEffect(() => {
    if (!loading) {
      setStatusMessage(selected.size > 0 ? `${selected.size} selected · ${count} items` : `${count} items`)
    }
  }, [count, loading, selected.size, setStatusMessage])

  // Esc clears the selection, like a file manager
  useEffect(() => {
    if (selected.size === 0) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (e.key === 'Escape' && !(el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) setSelected(new Set())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected.size])

  // "I" toggles the details pane
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)
      if (e.key.toLowerCase() === 'i' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) setInfoPaneOpen(!infoPaneOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [infoPaneOpen, setInfoPaneOpen])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = () => {
    if (selected.size === records.length) setSelected(new Set())
    else setSelected(new Set(records.map((r) => r.id)))
  }

  const setOrdering = (value: string) => {
    const p = new URLSearchParams(searchParams)
    p.set('ordering', value)
    p.set('page', '1')
    setSearchParams(p)
  }

  /** Header click: same column flips direction, a new column starts in its natural direction. */
  const sortBy = (field: string) => {
    const current = ordering.replace(/^-/, '')
    if (field === current) setOrdering(ordering.startsWith('-') ? field : `-${field}`)
    else setOrdering(SORT_FIELDS.find((f) => f.field === field)?.startDesc ? `-${field}` : field)
  }

  const openContextMenu = (e: React.MouseEvent, record: RecordListItem) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, record })
  }

  const toggleStar = async (record: RecordListItem) => {
    if (record.isStarred) await recordsApi.unstarRecord(record.id)
    else await recordsApi.starRecord(record.id)
    refresh()
  }
  const download = (record: RecordListItem) => { void queueDownload(record.id, record.fileName ?? record.title) }

  const menuItems = menu
    ? buildRecordContextMenuItems(menu.record, {
        onOpen: () => navigate(recordDetailPath(menu.record.id)),
        onSelect: () => toggleSelect(menu.record.id),
        onStar: () => toggleStar(menu.record),
        onDownload: () => download(menu.record),
        onCopyLink: () => copyRecordLink(menu.record.id),
        onClearSelection: () => setSelected(new Set()),
        hasSelection: selected.size > 0,
        onDelete: canDelete
          ? () => setConfirmDelete({ records: [menu.record], anchor: { x: menu.x, y: menu.y } })
          : undefined,
      })
    : []

  const performDelete = async () => {
    if (!confirmDelete) return
    setDeleteError('')
    const failures: string[] = []
    for (const record of confirmDelete.records) {
      try {
        await recordsApi.deleteRecord(record.id)
      } catch (err) {
        const detail = isAxiosError(err) ? err.response?.data?.detail : undefined
        failures.push(`${record.title}: ${detail ?? 'deletion failed'}`)
      }
    }
    setConfirmDelete(null)
    setSelected(new Set())
    if (failures.length > 0) setDeleteError(failures.join(' — '))
    refresh()
  }

  const toolbarCrumbs = breadcrumbs.length > 0 ? breadcrumbs : title ? [{ label: title }] : []
  const selectedRecords = records.filter((r) => selected.has(r.id))
  const single = selectedRecords.length === 1 ? selectedRecords[0] : undefined
  const paneRecord = records.find((r) => r.id === focusedId) ?? single
  const selecting = selected.size > 0

  const listBody = loading ? (
    <div className="p-6 space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  ) : records.length === 0 ? (
    <div className="drive-empty">
      <div className="drive-empty-icon">
        <FolderOpen size={28} strokeWidth={1.5} />
      </div>
      <p className="font-medium text-[var(--text-primary)]">This folder is empty</p>
      <p className="text-sm text-muted mt-1 max-w-sm">
        {subtitle || 'Upload a document or adjust your filters.'}
      </p>
      {enableBulk && canDelete && <Link to="/upload" className="btn-primary btn-sm mt-4">Upload</Link>}
    </div>
  ) : viewMode === 'grid' ? (
    <div className="drive-file-grid">
      {records.map((record) => (
        <RecordGridCard
          key={record.id}
          record={record}
          selected={selected.has(record.id)}
          focused={paneRecord?.id === record.id}
          enableBulk={enableBulk}
          paneOpen={paneOpen}
          onToggleSelect={toggleSelect}
          onFocusRecord={setFocusedId}
          onContextMenu={openContextMenu}
        />
      ))}
    </div>
  ) : driveMode ? (
    <>
      {!selecting && (
        <ResizableDriveListHeader
          enableBulk={enableBulk}
          allSelected={records.length > 0 && selected.size === records.length}
          someSelected={selecting}
          onToggleAll={toggleAll}
          ordering={ordering}
          onSort={sortBy}
        />
      )}
      {records.map((record) => (
        <RecordRow
          key={record.id}
          record={record}
          variant="drive-list"
          enableBulk={enableBulk}
          selected={selected.has(record.id)}
          focused={paneRecord?.id === record.id}
          onToggleSelect={toggleSelect}
          onFocusRecord={setFocusedId}
          onContextMenu={openContextMenu}
        />
      ))}
    </>
  ) : (
    <div className="panel p-0 overflow-x-auto">
      <table className="registry-table">
        <thead>
          <tr>
            {enableBulk && <th className="w-10" />}
            <th>Reference</th>
            <th>Title</th>
            <th>Type</th>
            <th>Modified</th>
            <th className="text-end">Size</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              variant="table"
              enableBulk={enableBulk}
              selected={selected.has(record.id)}
              onToggleSelect={toggleSelect}
              onContextMenu={openContextMenu}
            />
          ))}
        </tbody>
      </table>
    </div>
  )

  if (!driveMode) {
    return <div className="space-y-4">{listBody}</div>
  }

  const lastCrumb = toolbarCrumbs[toolbarCrumbs.length - 1]?.label ?? 'Saved view'

  return (
    <div className="flex flex-col min-h-full">
      <DriveToolbar
        breadcrumbs={toolbarCrumbs}
        onRefresh={refresh}
        viewControl={
          <>
            <PinButton defaultLabel={lastCrumb} />
            <ViewSortMenu ordering={ordering} onOrderingChange={setOrdering} />
          </>
        }
      />

      {header}

      {selecting && (
        <SelectionBar
          count={selected.size}
          onClear={() => setSelected(new Set())}
          onOpen={single ? () => navigate(recordDetailPath(single.id)) : undefined}
          onShare={single && canDelete ? () => setSharing(single) : undefined}
          onCopyLinks={async () => {
            await navigator.clipboard.writeText(selectedRecords.map((r) => recordAbsoluteUrl(r.id)).join('\n'))
          }}
          onDownload={() => selectedRecords.forEach(download)}
          onMove={canDelete ? () => setMoving([...selected]) : undefined}
          onStar={async () => {
            await Promise.all(selectedRecords.filter((r) => !r.isStarred).map((r) => recordsApi.starRecord(r.id)))
            refresh()
          }}
          onDelete={canDelete
            ? (e) => setConfirmDelete({ records: selectedRecords, anchor: anchorFromEvent(e) })
            : undefined}
        />
      )}

      {deleteError && (
        <div className="alert-danger mx-4 mt-3">
          <span className="flex-1">{deleteError}</span>
          <button type="button" className="underline text-xs shrink-0" onClick={() => setDeleteError('')}>Dismiss</button>
        </div>
      )}

      <ConfirmPopover
        anchor={confirmDelete?.anchor ?? null}
        message={confirmDelete && (
          <>
            Delete {confirmDelete.records.length === 1 ? `“${confirmDelete.records[0].title}”` : `${confirmDelete.records.length} records`}?
            This archives the record and removes it from all views.
          </>
        )}
        onConfirm={performDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <div className="flex min-h-0 flex-1">
        <div className={clsx('min-w-0 flex-1', viewMode === 'compact' && 'drive-compact', selecting && 'drive-selecting')}>
          {listBody}
        </div>
        {paneOpen && (
          <DetailsPane
            record={paneRecord}
            selectedCount={selected.size}
            onClose={() => setInfoPaneOpen(false)}
            onStar={toggleStar}
            onDownload={download}
            onCopyLink={(r) => copyRecordLink(r.id)}
          />
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-registry text-sm">
          <span className="text-muted">{count} record(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => {
              const p = new URLSearchParams(searchParams)
              p.set('page', String(page - 1))
              setSearchParams(p)
            }}>Previous</Button>
            <span className="px-2 py-1 text-muted tabular-nums">{page} / {totalPages}</span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => {
              const p = new URLSearchParams(searchParams)
              p.set('page', String(page + 1))
              setSearchParams(p)
            }}>Next</Button>
          </div>
        </div>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {moving && (
        <MoveDialog
          recordIds={moving}
          onClose={() => setMoving(null)}
          onMoved={() => { setMoving(null); setSelected(new Set()); refresh() }}
        />
      )}
      <ShareDialog open={!!sharing} onClose={() => setSharing(null)} recordId={sharing?.id} recordTitle={sharing?.title} />
    </div>
  )
}

function FileBrowserComponent(props: FileBrowserProps) {
  if (props.driveMode !== false) {
    return (
      <ResizableColumnsProvider>
        <FileBrowserInner {...props} />
      </ResizableColumnsProvider>
    )
  }
  return <FileBrowserInner {...props} />
}

export default memo(FileBrowserComponent)
