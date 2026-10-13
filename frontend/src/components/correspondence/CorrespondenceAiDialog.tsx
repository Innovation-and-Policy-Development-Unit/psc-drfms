import { useState } from 'react'
import { Sparkles, Copy, Check, X } from 'lucide-react'
import { aiApi, aiErrorMessage, type RouteSuggestion } from '@/api/ai'
import { correspondenceApi } from '@/api'
import { engineLabel } from '@/hooks/useAiStatus'
import type { Correspondence } from '@/types/api'
import { Button } from '@/components/ui/Button'

interface Props {
  item: Correspondence
  onClose: () => void
  onChanged: () => void
}

/** Suggest who should handle a letter, and draft a reply. Both are suggestions; nothing is sent. */
export default function CorrespondenceAiDialog({ item, onClose, onChanged }: Props) {
  const [route, setRoute] = useState<RouteSuggestion | null>(null)
  const [draft, setDraft] = useState('')
  const [draftEngine, setDraftEngine] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState<'route' | 'draft' | 'assign' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [assigned, setAssigned] = useState(false)

  const suggestRoute = async () => {
    setBusy('route')
    setError('')
    try { setRoute((await aiApi.routeCorrespondence(item.id)).data) }
    catch (e) { setError(aiErrorMessage(e)) }
    finally { setBusy(null) }
  }

  const writeDraft = async () => {
    setBusy('draft')
    setError('')
    try {
      const { data } = await aiApi.draftReply(item.id, instructions)
      setDraft(data.draft)
      setDraftEngine(data.engine)
    } catch (e) { setError(aiErrorMessage(e)) }
    finally { setBusy(null) }
  }

  const assign = async (userId: number) => {
    setBusy('assign')
    setError('')
    try {
      await correspondenceApi.update(item.id, { assignedTo: userId, ...(route?.priority ? { priority: route.priority } : {}) })
      setAssigned(true)
      onChanged()
    } catch (e) { setError(aiErrorMessage(e)) }
    finally { setBusy(null) }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="panel animate-registry-in max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Sparkles size={18} className="text-primary-500" /> AI assistant</h2>
            <p className="mt-0.5 truncate text-sm text-muted">{item.referenceNumber} · {item.subject}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Who should handle this?</h3>
          {!route ? (
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={suggestRoute}>{busy === 'route' ? 'Thinking…' : 'Suggest department'}</Button>
          ) : (
            <div className="space-y-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">
              <p>
                {route.department
                  ? <>Suggested department: <strong>{route.department.name}</strong> ({Math.round(route.confidence * 100)}% sure)</>
                  : 'No department clearly fits. Assign it manually.'}
                {route.priority && <> · priority <strong>{route.priority}</strong></>}
              </p>
              {route.reason && <p className="text-xs text-muted">{route.reason}</p>}
              {route.assignees.length > 0 && !assigned && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">Assign to:</span>
                  {route.assignees.map((a) => (
                    <button key={a.id} type="button" disabled={busy !== null} onClick={() => assign(a.id)}
                      className="rounded-full border border-primary-200 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-500/30 dark:text-primary-300">
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
              {assigned && <p className="flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> Assigned.</p>}
              <p className="text-[10px] text-gray-400">Suggested by {engineLabel(route.engine)}.</p>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Draft a reply</h3>
          <input value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={500}
            placeholder="Optional: tell it what to say, e.g. decline politely and offer a meeting"
            className="input" aria-label="Instructions for the draft" />
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={writeDraft}>{busy === 'draft' ? 'Writing…' : draft ? 'Write again' : 'Draft reply'}</Button>
          {draft && (
            <div className="space-y-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} className="input w-full font-sans text-sm" aria-label="Draft reply" />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">Drafted by {engineLabel(draftEngine)}. Review and complete the [placeholders] before sending.</p>
                <Button size="sm" variant="ghost" onClick={copy}>{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</Button>
              </div>
            </div>
          )}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
