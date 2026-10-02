import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { searchApi, type SimilarRecord } from '@/api'
import { DocumentTypeBadge } from '@/lib/recordBadges'
import { Skeleton } from '@/components/ui/Skeleton'

/** "More like this": records close in meaning, found with embedding vectors stored in our own database. */
export default function SimilarRecords({ recordId }: { recordId: string }) {
  const [items, setItems] = useState<SimilarRecord[] | null>(null)
  const [indexed, setIndexed] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setItems(null)
    setFailed(false)
    searchApi.similar(recordId)
      .then(({ data }) => {
        if (cancelled) return
        setItems(data.results)
        setIndexed(data.indexed)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [recordId])

  if (failed) return null

  return (
    <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
          <Layers size={14} />
        </span>
        <h3 className="font-sans text-sm font-semibold text-gray-900 dark:text-white">Similar documents</h3>
      </div>

      {items === null ? (
        <div className="mt-3"><Skeleton lines={3} /></div>
      ) : !indexed ? (
        <p className="mt-3 text-xs text-gray-500">Still being indexed. Related documents appear here shortly.</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">No closely related documents found.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((r) => (
            <li key={r.id}>
              <Link
                to={`/document/${r.id}`}
                className="block rounded-xl border border-gray-100 p-2.5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"
              >
                <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{r.title}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  <span className="font-mono-ref truncate">{r.referenceNumber}</span>
                  <DocumentTypeBadge type={r.documentType} />
                  <span className="ms-auto tabular-nums" title="Similarity of meaning">{Math.round(r.similarity * 100)}%</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
