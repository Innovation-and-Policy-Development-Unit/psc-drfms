import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag } from 'lucide-react'
import * as recordsApi from '@/api/records'
import { Skeleton } from '@/components/ui/Skeleton'

/** Every tag on records the viewer may see, biggest first. */
export default function TagsPage() {
  const [tags, setTags] = useState<Array<{ tag: string; count: number }> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    recordsApi.getTags()
      .then(({ data }) => setTags(data))
      .catch(() => setFailed(true))
  }, [])

  const biggest = tags?.[0]?.count ?? 1

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Tags</h1>
        <p className="mt-1 text-sm text-gray-500">Labels added to records. Choose one to see everything carrying it.</p>
      </div>

      {failed ? (
        <div className="alert-danger text-sm">Tags could not be loaded. Please try again.</div>
      ) : tags === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : tags.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 py-16 text-center dark:border-gray-800">
          <Tag size={32} className="mb-3 text-gray-300" />
          <p className="font-medium text-gray-700 dark:text-gray-200">No tags yet</p>
          <p className="mt-1 text-sm text-gray-400">Open a record and add tags to find related records quickly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tags.map((t) => (
            <Link
              key={t.tag}
              to={`/browse?tag=${encodeURIComponent(t.tag)}`}
              className="group rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500 dark:bg-primary-500/15">
                  <Tag size={15} />
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">{t.tag}</span>
              </span>
              <span className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>{t.count} {t.count === 1 ? 'record' : 'records'}</span>
              </span>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <span className="block h-full rounded-full bg-primary-500" style={{ width: `${Math.max(6, (t.count / biggest) * 100)}%` }} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
