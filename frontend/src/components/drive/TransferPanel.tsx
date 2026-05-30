import { memo } from 'react'
import { Upload, Download, X, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import clsx from 'clsx'
import { useTransfers } from '@/context/TransferContext'
import { formatFileSize } from '@/utils/fileType'
import { getFileTypeInfo } from '@/utils/fileType'

function CircularProgress({ value, icon: Icon }: { value: number; icon: typeof Upload }) {
  const r = 14
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <div className="transfer-ring">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--border-default)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="var(--brand-mega)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
      <Icon size={14} className="transfer-ring-icon" />
    </div>
  )
}

function TransferRow({ item, onCancel }: { item: ReturnType<typeof useTransfers>['transfers'][0]; onCancel: () => void }) {
  const typeInfo = getFileTypeInfo('', item.name)
  const Icon = item.type === 'upload' ? ArrowUp : ArrowDown
  const FileIcon = typeInfo.Icon

  return (
    <tr className={clsx('transfer-row', item.status)}>
      <td>
        <div className={clsx('transfer-file-icon', typeInfo.light)}>
          <FileIcon size={18} />
        </div>
      </td>
      <td className="transfer-name-cell">
        <p className="transfer-name" title={item.name}>{item.name}</p>
        <div className="transfer-progress-track">
          <div className="transfer-progress-fill" style={{ width: `${item.progress}%` }} />
        </div>
      </td>
      <td className="transfer-status-cell">
        {item.status === 'transferring' && (
          <span className="text-xs tabular-nums">
            {formatFileSize(item.speedBps)}/s · {item.progress}%
          </span>
        )}
        {item.status === 'completed' && <span className="transfer-status-ok">Completed</span>}
        {item.status === 'error' && <span className="transfer-status-err">{item.error ?? 'Failed'}</span>}
        {item.status === 'cancelled' && <span className="text-muted text-xs">Cancelled</span>}
        {item.status === 'queued' && <span className="text-muted text-xs">Queued…</span>}
      </td>
      <td className="transfer-action-cell">
        {(item.status === 'transferring' || item.status === 'queued') && (
          <button type="button" className="transfer-icon-btn" onClick={onCancel} aria-label="Cancel">
            <X size={14} />
          </button>
        )}
        <Icon size={12} className={clsx('transfer-type-icon', item.type)} />
      </td>
    </tr>
  )
}

function TransferPanelComponent() {
  const {
    transfers,
    panelOpen,
    setPanelOpen,
    uploadProgress,
    downloadProgress,
    activeCount,
    cancelTransfer,
    clearCompleted,
    clearAll,
  } = useTransfers()

  const hasActive = transfers.some((t) => t.status === 'transferring' || t.status === 'queued')
  const hasCompleted = transfers.some((t) => t.status === 'completed' || t.status === 'cancelled')

  const uploadActive = transfers.some((t) => t.type === 'upload' && (t.status === 'transferring' || t.status === 'queued'))
  const downloadActive = transfers.some((t) => t.type === 'download' && (t.status === 'transferring' || t.status === 'queued'))

  if (transfers.length === 0) return null

  return (
    <section className={clsx('transfer-panel', panelOpen && 'open')}>
      <div className="transfer-panel-header">
        <div className="transfer-panel-title">
          {uploadActive && (
            <div className="transfer-summary">
              <CircularProgress value={uploadProgress} icon={Upload} />
              <span>Uploading… {uploadProgress}%</span>
            </div>
          )}
          {downloadActive && (
            <div className="transfer-summary">
              <CircularProgress value={downloadProgress} icon={Download} />
              <span>Downloading… {downloadProgress}%</span>
            </div>
          )}
          {!uploadActive && !downloadActive && (
            <span className="text-sm font-medium">Transfers</span>
          )}
        </div>
        <div className="transfer-panel-actions">
          <button
            type="button"
            className="transfer-action-btn"
            disabled={!hasCompleted}
            onClick={clearCompleted}
          >
            <Trash2 size={14} />
            Clear completed
          </button>
          <button
            type="button"
            className="transfer-action-btn danger"
            disabled={transfers.length === 0}
            onClick={clearAll}
          >
            <X size={14} />
            Clear all
          </button>
          <button
            type="button"
            className="transfer-action-btn"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            {panelOpen ? 'Minimize' : 'Expand'}
          </button>
        </div>
      </div>

      {panelOpen && (
        <div className="transfer-table-wrap">
          {transfers.length === 0 ? (
            <div className="transfer-empty">
              <Download size={32} strokeWidth={1.25} className="text-muted mb-2" />
              <p className="text-sm text-muted">No transfers</p>
            </div>
          ) : (
            <table className="transfer-table">
              <thead>
                <tr>
                  <th className="w-12" />
                  <th>Name</th>
                  <th className="w-36">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {transfers.map((item) => (
                  <TransferRow key={item.id} item={item} onCancel={() => cancelTransfer(item.id)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  )
}

export const TransferPanel = memo(TransferPanelComponent)
