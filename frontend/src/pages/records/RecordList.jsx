import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { recordsApi } from '../../api'
import {
  Plus, Search, Filter, FolderOpen, Lock, Star,
  Eye, Upload, ChevronLeft, ChevronRight, AlertTriangle
} from 'lucide-react'

const CLASSIFICATION_BADGES = {
  unclassified: 'badge-secondary',
  internal: 'badge-info',
  confidential: 'badge-warning',
  restricted: 'badge-danger',
  secret: 'badge-danger',
}

const DOC_TYPE_LABELS = {
  correspondence: 'Correspondence',
  personnel_file: 'Personnel File',
  board_paper: 'Board Paper',
  policy: 'Policy',
  circular: 'Circular',
  report: 'Report',
  submission: 'Submission',
  disciplinary: 'Disciplinary',
  contract: 'Contract',
  financial: 'Financial',
  legal: 'Legal',
  other: 'Other',
}

export default function RecordList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [records, setRecords] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const page = parseInt(searchParams.get('page') || '1')

  const fetchRecords = () => {
    setLoading(true)
    const params = { page, page_size: 25 }
    if (search) params.search = search
    const docType = searchParams.get('document_type')
    const vital = searchParams.get('is_vital')
    if (docType) params.document_type = docType
    if (vital) params.is_vital = vital

    recordsApi.getRecords(params)
      .then(({ data }) => {
        setRecords(data.results || data)
        setCount(data.count || (data.results || data).length)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRecords() }, [page, searchParams])

  const handleSearch = (e) => {
    e.preventDefault()
    const p = new URLSearchParams(searchParams)
    if (search) p.set('search', search)
    else p.delete('search')
    p.set('page', '1')
    setSearchParams(p)
  }

  const totalPages = Math.ceil(count / 25)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Records</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5">{count} total records</p>
        </div>
        <Link to="/upload" className="btn-primary">
          <Upload size={16} /> Upload Record
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="card p-4 flex gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-64">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10"
              placeholder="Search records, reference numbers, content…"
            />
          </div>
          <button type="submit" className="btn-primary btn-sm">Search</button>
        </form>
        <select
          className="input w-auto"
          value={searchParams.get('document_type') || ''}
          onChange={e => {
            const p = new URLSearchParams(searchParams)
            if (e.target.value) p.set('document_type', e.target.value)
            else p.delete('document_type')
            p.set('page', '1')
            setSearchParams(p)
          }}
        >
          <option value="">All Types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={searchParams.get('is_vital') === 'true'}
            onChange={e => {
              const p = new URLSearchParams(searchParams)
              if (e.target.checked) p.set('is_vital', 'true')
              else p.delete('is_vital')
              p.set('page', '1')
              setSearchParams(p)
            }}
          />
          Vital only
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Type</th>
                <th>Classification</th>
                <th>Custodian</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j}><div className="skeleton h-4 rounded w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <FolderOpen size={40} className="mx-auto mb-2 opacity-30" />
                    <p>No records found</p>
                  </td>
                </tr>
              ) : records.map(record => (
                <tr key={record.id}>
                  <td>
                    <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                      {record.reference_number}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {record.is_vital && <Star size={13} className="text-amber-500 shrink-0" />}
                      {record.is_on_legal_hold && <Lock size={13} className="text-red-500 shrink-0" />}
                      <Link to={`/document/${record.id}`} className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 line-clamp-1">
                        {record.title}
                      </Link>
                    </div>
                  </td>
                  <td><span className="badge-secondary">{DOC_TYPE_LABELS[record.document_type] || record.document_type}</span></td>
                  <td><span className={CLASSIFICATION_BADGES[record.classification_level] || 'badge-secondary'}>{record.classification_level}</span></td>
                  <td className="text-sm">{record.custodian_name || '—'}</td>
                  <td className="text-sm text-slate-500">{record.document_date ? new Date(record.document_date).toLocaleDateString() : '—'}</td>
                  <td>
                    {record.is_on_legal_hold
                      ? <span className="badge-danger flex items-center gap-1"><Lock size={10} /> Hold</span>
                      : record.is_draft
                        ? <span className="badge-secondary">Draft</span>
                        : <span className="badge-success">Active</span>
                    }
                  </td>
                  <td>
                    <Link to={`/document/${record.id}`} className="btn-sm btn-ghost">
                      <Eye size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, count)} of {count}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSearchParams(p => { const np = new URLSearchParams(p); np.set('page', String(page - 1)); return np })}
                disabled={page === 1}
                className="btn-sm btn-outline"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="btn-sm btn-secondary">{page} / {totalPages}</span>
              <button
                onClick={() => setSearchParams(p => { const np = new URLSearchParams(p); np.set('page', String(page + 1)); return np })}
                disabled={page === totalPages}
                className="btn-sm btn-outline"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
