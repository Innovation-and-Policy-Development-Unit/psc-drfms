import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Tag, X } from 'lucide-react'
import { updateRecord } from '@/api/records'

const MAX_TAGS = 20
const MAX_LENGTH = 40

interface Props {
  recordId: string
  tags: string[]
  canEdit: boolean
  onChanged: () => void
}

/** Chips for a record's tags; people who may edit can add and remove them. */
export default function TagsEditor({ recordId, tags, canEdit, onChanged }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!canEdit && tags.length === 0) return null

  const save = async (next: string[]) => {
    setBusy(true)
    setError('')
    try {
      await updateRecord(recordId, { tags: next })
      onChanged()
    } catch {
      setError('Could not save the tags.')
    } finally {
      setBusy(false)
    }
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const tag = draft.split(/\s+/).filter(Boolean).join(' ').toLowerCase()
    if (!tag) return
    if (tag.length > MAX_LENGTH) { setError(`A tag can be at most ${MAX_LENGTH} characters.`); return }
    if (tags.includes(tag)) { setDraft(''); return }
    if (tags.length >= MAX_TAGS) { setError(`A record can have at most ${MAX_TAGS} tags.`); return }
    setDraft('')
    await save([...tags, tag])
  }

  return (
    <div>
      <dt className="label-overline">Tags</dt>
      <dd className="mt-1.5">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 ps-2.5 pe-1.5 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200">
              <Link to={`/browse?tag=${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 hover:text-primary-500">
                <Tag size={10} /> {t}
              </Link>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(tags.filter((x) => x !== t))}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/10"
                  aria-label={`Remove tag ${t}`}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <form onSubmit={add} className="mt-2">
            <input
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setError('') }}
              placeholder="Add a tag and press Enter"
              maxLength={MAX_LENGTH + 10}
              disabled={busy}
              className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs placeholder:text-gray-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/15 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
              aria-label="Add a tag"
            />
          </form>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </dd>
    </div>
  )
}
