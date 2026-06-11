import { useState, useEffect, FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchApi, unwrapList } from '@/api'
import type { RecordListItem } from '@/types/api'
import { RecordRow } from '@/components/documents/RecordRow'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<RecordListItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const doSearch = (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    searchApi.search({ q, ...Object.fromEntries(searchParams) })
      .then(({ data }) => {
        setResults(unwrapList<RecordListItem>(data))
        setCount((data as { count?: number }).count ?? 0)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      doSearch(q)
    }
  }, [searchParams.get('q')])

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams(searchParams)
    p.set('q', query)
    setSearchParams(p)
  }

  const activeQ = searchParams.get('q')

  return (
    <PageShell title="Search" subtitle="Full-text search across records and indexed content.">
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input flex-1"
          placeholder="Reference, title, ministry, PDF content…"
        />
        <Button type="submit">Search</Button>
      </form>

      {activeQ && (
        <p className="text-sm text-muted">
          {loading ? 'Searching…' : `${count} result${count !== 1 ? 's' : ''} for “${activeQ}”`}
        </p>
      )}

      <div className="space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : (
          results.map((record) => (
            <RecordRow key={record.id} record={record} variant="list" showSnippet />
          ))
        )}

        {!loading && activeQ && results.length === 0 && (
          <EmptyState
            title="No records found"
            description="Try different keywords or check spelling."
          />
        )}
      </div>
    </PageShell>
  )
}
