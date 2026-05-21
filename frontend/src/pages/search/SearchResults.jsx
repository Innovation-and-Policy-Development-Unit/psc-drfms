import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchApi } from '../../api'
import { Search, FileText, Clock, FolderOpen } from 'lucide-react'

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const doSearch = (q) => {
    if (!q.trim()) return
    setLoading(true)
    searchApi.search({ q, ...Object.fromEntries(searchParams) })
      .then(({ data }) => {
        setResults(data.results)
        setCount(data.count)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); doSearch(q) }
  }, [searchParams.get('q')])

  const handleSearch = (e) => {
    e.preventDefault()
    const p = new URLSearchParams(searchParams)
    p.set('q', query)
    setSearchParams(p)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Search documents</h1>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="input pl-11 py-3 text-base"
            placeholder="Search records, content inside PDFs, metadata…"
          />
        </div>
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>

      {searchParams.get('q') && (
        <p className="text-sm text-slate-500">
          {loading ? 'Searching…' : `${count} result${count !== 1 ? 's' : ''} for "${searchParams.get('q')}"`}
        </p>
      )}

      <div className="space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => <div key={i} className="card p-4 animate-pulse h-20 skeleton" />)
        ) : results.map(record => (
          <Link key={record.id} to={`/document/${record.id}`} className="card-hover block p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center shrink-0">
                <FileText size={16} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-slate-500">{record.reference_number}</span>
                  <span className="badge-secondary text-[10px]">{record.document_type?.replace('_', ' ')}</span>
                  <span className="badge-info text-[10px]">{record.classification_level}</span>
                </div>
                <h3 className="font-medium text-slate-900 dark:text-white mt-0.5 truncate">{record.title}</h3>
                {record.originating_ministry && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{record.originating_ministry}</p>
                )}
              </div>
              <div className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                <Clock size={11} />
                {new Date(record.created_at).toLocaleDateString()}
              </div>
            </div>
          </Link>
        ))}

        {!loading && searchParams.get('q') && results.length === 0 && (
          <div className="text-center py-16">
            <FolderOpen size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No records found for "{searchParams.get('q')}"</p>
            <p className="text-sm text-slate-400 mt-1">Try different keywords or check your spelling</p>
          </div>
        )}
      </div>
    </div>
  )
}
