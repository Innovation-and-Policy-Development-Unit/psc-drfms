import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, AlertCircle } from 'lucide-react'
import { aiApi, aiErrorMessage, type ReviewItem } from '@/api/ai'
import { PageShell } from '@/components/ui/PageShell'
import { Panel } from '@/components/ui/Panel'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { ClassificationBadge, DocumentTypeBadge } from '@/lib/recordBadges'

/** Records where the AI suggested something a person still has to decide: classification, retention, sensitive content. */
export default function AiReviewQueue() {
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    aiApi.reviewQueue()
      .then(({ data }) => setItems(data.results))
      .catch((e) => { setItems([]); setError(aiErrorMessage(e)) })
  }, [])

  const dismiss = async (id: string) => {
    setBusy(id)
    try {
      await aiApi.markReviewed(id)
      setItems((cur) => cur?.filter((i) => i.recordId !== id) ?? null)
    } catch (e) { setError(aiErrorMessage(e)) } finally { setBusy(null) }
  }

  return (
    <PageShell
      title="AI review queue"
      subtitle="Suggestions waiting for a person: open a record to accept or change them. Only empty fields the administrator allowed are ever filled automatically."
    >
      {error && <p className="mb-3 flex items-center gap-1.5 text-sm text-red-600"><AlertCircle size={14} /> {error}</p>}
      <Panel className="p-0">
        {items === null ? (
          <div className="p-6"><Skeleton lines={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState title="All caught up" description="No records are waiting for an AI suggestion review." />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((i) => (
              <li key={i.recordId} className="flex flex-wrap items-center gap-3 p-4">
                <ClipboardCheck size={18} className="shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <Link to={`/document/${i.recordId}`} className="block truncate text-sm font-medium text-gray-900 hover:underline dark:text-white">{i.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="font-mono-ref">{i.referenceNumber}</span>
                    <DocumentTypeBadge type={i.documentType} />
                    <ClassificationBadge level={i.classificationLevel} />
                  </div>
                  {i.reasons.length > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{i.reasons.join(' · ')}</p>}
                  {i.summary && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{i.summary}</p>}
                </div>
                <Link to={`/document/${i.recordId}`} className="btn-secondary btn-sm">Review</Link>
                <Button size="sm" variant="ghost" disabled={busy === i.recordId} onClick={() => dismiss(i.recordId)}>Mark reviewed</Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  )
}
