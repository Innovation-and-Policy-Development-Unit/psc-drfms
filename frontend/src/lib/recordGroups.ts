import type { RecordListItem } from '@/types/api'
import { DOC_TYPE_LABELS } from '@/lib/recordBadges'

export interface GroupOption {
  value: string
  label: string
  /** API ordering that puts a group's records next to each other */
  order: string
  key: (r: RecordListItem) => string
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

export const GROUP_OPTIONS: GroupOption[] = [
  { value: 'series', label: 'Record series', order: 'record_series__name', key: (r) => r.recordSeriesName || 'No series' },
  { value: 'ministry', label: 'Ministry', order: 'originating_ministry', key: (r) => r.originatingMinistry || 'No ministry' },
  { value: 'classification', label: 'Classification', order: 'classification_rank', key: (r) => cap(r.classificationLevel) },
  { value: 'type', label: 'Record type', order: 'document_type', key: (r) => DOC_TYPE_LABELS[r.documentType] ?? cap(r.documentType) },
  { value: 'year', label: 'Document year', order: '-document_date', key: (r) => r.documentDate?.slice(0, 4) || 'No date' },
]

export interface RecordGroup { label: string; rows: RecordListItem[] }

/** Consecutive records with the same key form a group; the API ordering has already put them side by side. */
export function groupRecords(records: RecordListItem[], option: GroupOption): RecordGroup[] {
  const groups: RecordGroup[] = []
  for (const r of records) {
    const label = option.key(r)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(r)
    else groups.push({ label, rows: [r] })
  }
  return groups
}
