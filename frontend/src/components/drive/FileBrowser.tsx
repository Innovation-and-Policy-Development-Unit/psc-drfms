import { memo, useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useRecords } from '@/hooks/useRecords'
import { useAuth } from '@/context/AuthContext'
import { useDriveUI } from '@/context/DriveUIContext'
import { ResizableColumnsProvider } from '@/context/ResizableColumnsContext'
import { RecordRow } from '@/components/documents/RecordRow'
import { RecordGridCard } from '@/components/documents/RecordGridCard'
import { DriveToolbar } from '@/components/drive/DriveToolbar'
import { ResizableDriveListHeader } from '@/components/drive/ResizableDriveList'
import { ContextMenu } from '@/components/drive/ContextMenu'
import { BulkActionBar } from '@/components/drive/BulkActionBar'
import { Button } from '@/components/ui/Button'
import { ConfirmPopover, anchorFromEvent, type ConfirmAnchor } from '@/components/ui/ConfirmPopover'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  buildRecordContextMenuItems,
  copyRecordLink,
  recordDetailPath,
} from '@/lib/driveRecordActions'
import * as recordsApi from '@/api/records'
import { useTransfers } from '@/context/TransferContext'
import type { BreadcrumbItem, RecordListItem } from '@/types/api'

const SORT_OPTIONS = [
  { value: '-updated_at', label: 'Last modified' },
  { value: 'title', label: 'Name A–Z' },
  { value: '-title', label: 'Name Z–A' },
  { value: '-created_at', label: 'Date added' },
  { value: 'reference_number', label: 'Reference' },
]

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
  const [menu, setMenu] = useState<{ x: number; y: number; record: RecordListItem } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ records: RecordListItem[]; anchor: ConfirmAnchor } | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const { user } = useAuth()
  const { viewMode, setStatusMessage, openUploadDialog } = useDriveUI()
  const { queueDownload } = useTransfers()

  const canDelete = ['records_officer', 'director', 'commissioner', 'administrator']
    .includes(user?.role ?? '')

  const page = parseInt(searchParams.get('page') || '1', 10)
  const ordering = searchParams.get('ordering') || defaultOrdering

  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = { page, page_size: pageSize, ordering }
    if (!filterParams.starred && !filterParams.shared_with_me) {
      const series = searchParams.get('record_series')
      const docType = searchParams.get('document_type')
      if (series) params.record_series = series
      if (docType) params.document_type = docType
    }
    Object.entries(filterParams).forEach(([k, v]) => { if (v) params[k] = v })
    return params
  }, [page, ordering, pageSize, searchParams, filterParams])

  const { records, count, loading, refresh } = useRecords(queryParams)
  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  useEffect(() => {
    if (!loading) {
      setStatusMessage(selected.size > 0 ? `${selected.size} selected · ${count} items` : `${count} items`)
    }
  }, [count, loading, selected.size, setStatusMessage])

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

  const handleSort = (value: string) => {
    const p = new URLSearchParams(searchParams)
    p.set('ordering', value)
    p.set('page', '1')
    setSearchParams(p)
  }

  const openContextMenu = (e: React.MouseEvent, record: RecordListItem) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, record })
  }

  const menuItems = menu
    ? buildRecordContextMenuItems(menu.record, {
        onOpen: () => navigate(recordDetailPath(menu.record.id)),
        onSelect: () => toggleSelect(menu.record.id),
        onStar: async () => {
          if (menu.record.isStarred) await recordsApi.unstarRecord(menu.record.id)
          else await recordsApi.starRecord(menu.record.id)
          refresh()
        },
        onDownload: () => {
          void queueDownload(menu.record.id, menu.record.fileName ?? menu.record.title)
        },
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
      {enableBulk && <Link to="/upload" className="btn-primary btn-sm mt-4">Upload</Link>}
    </div>
  ) : viewMode === 'grid' ? (
    <div className="drive-file-grid">
      {records.map((record) => (
        <RecordGridCard
          key={record.id}
          record={record}
          selected={selected.has(record.id)}
          enableBulk={enableBulk}
          onToggleSelect={toggleSelect}
          onContextMenu={openContextMenu}
        />
      ))}
    </div>
  ) : driveMode ? (
    <>
      <ResizableDriveListHeader
        enableBulk={enableBulk}
        allSelected={records.length > 0 && selected.size === records.length}
        someSelected={selected.size > 0}
        onToggleAll={toggleAll}
      />
      {records.map((record) => (
        <RecordRow
          key={record.id}
          record={record}
          variant="drive-list"
          enableBulk={enableBulk}
          selected={selected.has(record.id)}
          onToggleSelect={toggleSelect}
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

  const firstSelected = records.find((r) => selected.has(r.id))

  return (
    <div className="flex flex-col min-h-full">
      <DriveToolbar
        breadcrumbs={toolbarCrumbs}
        sortValue={ordering}
        sortOptions={SORT_OPTIONS}
        onSortChange={handleSort}
        onRefresh={refresh}
        actions={
          <button type="button" className="btn-primary btn-sm rounded-full px-4" onClick={() => openUploadDialog()}>
            Upload
          </button>
        }
      />

      {header}

      <BulkActionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onOpen={firstSelected ? () => navigate(recordDetailPath(firstSelected.id)) : undefined}
        onStar={selected.size > 0 ? async () => {
          await Promise.all([...selected].map((id) => recordsApi.starRecord(id)))
          refresh()
        } : undefined}
        onCopyLinks={selected.size > 0 ? async () => {
          await navigator.clipboard.writeText([...selected].map((id) => `${window.location.origin}${recordDetailPath(id)}`).join('\n'))
        } : undefined}
        onDelete={canDelete && selected.size > 0
          ? (e) => setConfirmDelete({ records: records.filter((r) => selected.has(r.id)), anchor: anchorFromEvent(e) })
          : undefined}
      />

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

      <div className="flex-1 min-h-0">{listBody}</div>

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
