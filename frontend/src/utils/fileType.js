import { FileText, FileSpreadsheet, FileImage, FileArchive, Mail, File } from 'lucide-react'

export function getFileTypeInfo(mimeType = '', fileName = '') {
  const mime = (mimeType || '').toLowerCase()
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ''

  if (mime.includes('pdf') || ext === 'pdf') {
    return {
      label: 'PDF', Icon: FileText, color: 'bg-red-500',
      light: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      previewable: true, officeType: null,
    }
  }
  if (mime.includes('word') || ext === 'doc' || ext === 'docx') {
    return {
      label: 'Word', Icon: FileText, color: 'bg-blue-600',
      light: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      previewable: false, officeType: 'word',
    }
  }
  if (mime.includes('sheet') || mime.includes('excel') || ext === 'xls' || ext === 'xlsx') {
    return {
      label: 'Excel', Icon: FileSpreadsheet, color: 'bg-emerald-600',
      light: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      previewable: false, officeType: 'excel',
    }
  }
  if (mime.includes('presentation') || mime.includes('powerpoint') || ext === 'ppt' || ext === 'pptx') {
    return {
      label: 'PowerPoint', Icon: FileText, color: 'bg-orange-600',
      light: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      previewable: false, officeType: 'powerpoint',
    }
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff'].includes(ext)) {
    return {
      label: 'Image', Icon: FileImage, color: 'bg-violet-500',
      light: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      previewable: true, officeType: null,
    }
  }
  if (mime.includes('zip') || ext === 'zip') {
    return {
      label: 'Archive', Icon: FileArchive, color: 'bg-amber-600',
      light: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      previewable: false, officeType: null,
    }
  }
  if (mime.includes('message') || ext === 'eml' || ext === 'msg') {
    return {
      label: 'Email', Icon: Mail, color: 'bg-slate-600',
      light: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
      previewable: false, officeType: null,
    }
  }
  return {
    label: 'File', Icon: File, color: 'bg-slate-500',
    light: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    previewable: false, officeType: null,
  }
}

export function getOfficeOpenUrl(officeType, fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase()
  if (officeType === 'word') return `ms-word:ofe|u|`
  if (officeType === 'excel') return `ms-excel:ofe|u|`
  if (officeType === 'powerpoint') return `ms-powerpoint:ofe|u|`
  if (ext === 'doc' || ext === 'docx') return `ms-word:ofe|u|`
  if (ext === 'xls' || ext === 'xlsx') return `ms-excel:ofe|u|`
  return null
}

export function formatFileSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
