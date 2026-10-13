import { useState } from 'react'
import { Sparkles, Copy, Check, X } from 'lucide-react'
import { aiApi, aiErrorMessage } from '@/api/ai'
import { engineLabel } from '@/hooks/useAiStatus'
import type { Correspondence } from '@/types/api'
import { Button } from '@/components/ui/Button'

interface Props {
  item: Correspondence
  onClose: () => void
}

/** Drafts a reply to a letter. The draft is a suggestion; nothing is sent. */
export default function CorrespondenceAiDialog({ item, onClose }: Props) {
  const [draft, setDraft] = useState('')
  const [draftEngine, setDraftEngine] = useState('')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState<'draft' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

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

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="panel animate-registry-in max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Sparkles size={18} className="text-primary-500" /> Draft a reply</h2>
            <p className="mt-0.5 truncate text-sm text-muted">{item.referenceNumber} · {item.subject}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X size={16} /></button>
        </div>

        <section className="space-y-2">
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
