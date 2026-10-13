import { useEffect, useRef, useState } from 'react'
import { Sparkles, RefreshCw, MessageSquare, Send, ShieldCheck, Cloud } from 'lucide-react'
import { aiApi, aiErrorMessage, type ChatMessage } from '@/api/ai'
import { engineLabel, useAiStatus } from '@/hooks/useAiStatus'
import type { RecordDetail } from '@/types/api'

interface Props {
  record: RecordDetail
  canEdit: boolean
  onChanged: () => void
}

/** AI summary of the latest version, plus a small "ask this document" chat. */
export default function DocumentAiPanel({ record, canEdit, onChanged }: Props) {
  const status = useAiStatus()
  const version = record.latestVersion ?? record.latest_version
  const summary = version?.aiSummary
  const engine = version?.aiEngine
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMessages([]); setQueued(false); setError('') }, [record.id])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages, busy])

  // A queued summary lands on the record a few seconds later: poll briefly
  useEffect(() => {
    if (!queued) return
    let tries = 0
    const t = setInterval(() => {
      tries += 1
      onChanged()
      if (tries >= 8) { clearInterval(t); setQueued(false) }
    }, 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued])
  useEffect(() => { if (queued && summary) setQueued(false) }, [summary, queued])

  if (!version || (!status?.enabled && !summary)) return null

  const regenerate = async () => {
    setError('')
    try {
      await aiApi.summarize(record.id)
      setQueued(true)
    } catch (e) { setError(aiErrorMessage(e)) }
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const { data } = await aiApi.chat(record.id, next)
      setMessages([...next, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setError(aiErrorMessage(err))
    } finally { setBusy(false) }
  }

  const external = engine ? !engine.startsWith('ollama') : false

  return (
    <section className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500 text-white"><Sparkles size={14} /></span>
        <h3 className="font-sans text-sm font-semibold text-gray-900 dark:text-white">AI summary</h3>
        {canEdit && status?.enabled && (
          <button type="button" onClick={regenerate} disabled={queued} title="Write a fresh summary"
            className="ms-auto rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-white/10">
            <RefreshCw size={14} className={queued ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {summary ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-200">{summary}</p>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          {queued ? 'Writing the summary…' : 'No summary yet. It is written automatically after a document is scanned.'}
        </p>
      )}

      {status?.enabled && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline dark:text-primary-300">
            <MessageSquare size={13} /> {open ? 'Hide questions' : 'Ask about this document'}
          </button>

          {open && (
            <div className="mt-3 space-y-2">
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {messages.map((m, i) => (
                  <p key={i} className={m.role === 'user'
                    ? 'ms-6 rounded-xl bg-primary-50 px-3 py-2 text-sm text-gray-800 dark:bg-primary-500/15 dark:text-gray-100'
                    : 'me-6 whitespace-pre-line rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-200'}>
                    {m.content}
                  </p>
                ))}
                {busy && <p className="me-6 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-400 dark:bg-white/5">Reading the document…</p>}
                <div ref={endRef} />
              </div>
              <form onSubmit={send} className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
                  placeholder="e.g. What deadline is mentioned?"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-white/5 dark:text-white" />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Send"
                  className="rounded-xl bg-primary-500 px-3 text-white hover:bg-primary-600 disabled:opacity-50"><Send size={14} /></button>
              </form>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-400">
        {external ? <Cloud size={12} /> : <ShieldCheck size={12} />}
        {engine ? `Written by ${engineLabel(engine)}. May contain mistakes; check against the document.` : 'AI-generated. Check against the document.'}
      </p>
    </section>
  )
}
