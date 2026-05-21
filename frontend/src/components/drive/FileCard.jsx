import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Lock, Star } from 'lucide-react'
import { getFileTypeInfo, formatFileSize } from '../../utils/fileType'
import { recordsApi } from '../../api'

export default function FileCard({ record, showStarToggle = false, onStarChange }) {
  const { Icon, color, light } = getFileTypeInfo(record.mime_type, record.file_name)
  const modified = record.updated_at ? new Date(record.updated_at) : null

  const toggleStar = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      if (record.is_starred) {
        await recordsApi.unstarRecord(record.id)
        onStarChange?.(record.id, false)
      } else {
        await recordsApi.starRecord(record.id)
        onStarChange?.(record.id, true)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Link
      to={`/document/${record.id}`}
      className="group flex flex-col rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-150 overflow-hidden"
    >
      <div className="aspect-[4/3] flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 relative">
        <div className={clsx('w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-sm', color)}>
          <Icon size={28} strokeWidth={1.5} />
        </div>
        <div className="absolute top-2 end-2 flex gap-1 items-center">
          {showStarToggle && (
            <button
              type="button"
              onClick={toggleStar}
              className="p-1 rounded-full bg-white/90 dark:bg-slate-800/90 shadow hover:scale-110 transition-transform"
              title={record.is_starred ? 'Unstar' : 'Star'}
            >
              <Star
                size={14}
                className={record.is_starred ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}
              />
            </button>
          )}
          {record.is_vital && <Star size={14} className="text-amber-500 fill-amber-500" />}
          {record.is_on_legal_hold && <Lock size={14} className="text-red-500" />}
        </div>
      </div>
      <div className="p-3 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400" title={record.title}>
          {record.title}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={record.file_name || record.reference_number}>
          {record.file_name || record.reference_number}
        </p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded', light)}>
            {getFileTypeInfo(record.mime_type, record.file_name).label}
          </span>
          <span className="text-[10px] text-slate-400 shrink-0">
            {modified ? modified.toLocaleDateString() : formatFileSize(record.file_size)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function StarButton({ record, onChange }) {
  const toggle = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      if (record.is_starred) {
        await recordsApi.unstarRecord(record.id)
        onChange?.(record.id, false)
      } else {
        await recordsApi.starRecord(record.id)
        onChange?.(record.id, true)
      }
    } catch (err) {
      console.error(err)
    }
  }
  return (
    <button type="button" onClick={toggle} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title={record.is_starred ? 'Unstar' : 'Star'}>
      <Star size={14} className={record.is_starred ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />
    </button>
  )
}
