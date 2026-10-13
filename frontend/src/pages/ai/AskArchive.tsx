import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Send, FileText, Cloud, ShieldCheck, RotateCcw, AlertCircle } from 'lucide-react'
import { aiApi, aiErrorMessage, type AskSource, type ChatMessage } from '@/api/ai'
import { engineLabel, useAiStatus } from '@/hooks/useAiStatus'
import { DocumentTypeBadge } from '@/lib/recordBadges'

interface Turn extends ChatMessage {
  sources?: AskSource[]
  excluded?: number
  engine?: string
}

const EXAMPLES = [
  'What did the Commission decide about leave policy?',
  'Which contracts mention a termination clause?',
  'Summarise the most recent circular about recruitment.',
]

/** Turn "[1][2]" in an answer into links that jump to the matching source card. */
function Answer({ text, sources }: { text: string; sources: AskSource[] }) {
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-gray-100">
      {text.split(/(\[\d+\])/g).map((part, i) => {
        const m = /^\[(\d+)\]$/.exec(part)
        if (!m) return <Fragment key={i}>{part}</Fragment>
        const n = Number(m[1])
        return sources.some((s) => s.n === n)
          ? <a key={i} href={`#source-${n}`} className="mx-0.5 rounded bg-primary-50 px-1 text-xs font-semibold text-primary-600 no-underline hover:bg-primary-100 dark:bg-primary-500/20 dark:text-primary-300">{n}</a>
          : <Fragment key={i}>{part}</Fragment>
      })}
    </p>
  )
}

export default function AskArchive() {
  const status = useAiStatus()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [turns, busy])

  const ask = async (question: string) => {
    const text = question.trim()
    if (!text || busy) return
    const history: Turn[] = [...turns, { role: 'user', content: text }]
    setTurns(history)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const { data } = await aiApi.ask(history.map(({ role, content }) => ({ role, content })))
      setTurns([...history, { role: 'assistant', content: data.answer, sources: data.sources, excluded: data.excludedRecords, engine: data.engine }])
    } catch (e) {
      setError(aiErrorMessage(e))
    } finally { setBusy(false) }
  }

  const off = status !== null && !status.enabled
  const cloud = status?.primary?.external

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 font-sans text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          <Sparkles size={22} className="text-primary-500" /> Ask the archive
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Ask a question in plain language. Answers come only from records you are allowed to open, with links to the source passages.
        </p>
      </div>

      {off && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          AI is not set up on this system yet. An administrator needs to choose a model (LLM_PROVIDER) in the server settings.
        </div>
      )}

      {turns.length === 0 && !off && (
        <div className="grid gap-2 sm:grid-cols-3">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" onClick={() => ask(q)}
              className="rounded-2xl border border-gray-200 p-3 text-start text-sm text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50/50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/5">
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {turns.map((t, i) => t.role === 'user' ? (
          <p key={i} className="ms-auto w-fit max-w-[85%] rounded-2xl bg-primary-500 px-4 py-2.5 text-sm text-white">{t.content}</p>
        ) : (
          <div key={i} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <Answer text={t.content} sources={t.sources ?? []} />
            {!!t.excluded && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {t.excluded} matching record{t.excluded > 1 ? 's were' : ' was'} not consulted: {t.excluded > 1 ? 'their' : 'its'} classification does not allow AI to read it.
              </p>
            )}
            {!!t.sources?.length && (
              <div className="grid gap-2 sm:grid-cols-2">
                {t.sources.map((s) => (
                  <Link key={s.n} id={`source-${s.n}`} to={`/document/${s.recordId}`}
                    className={`block scroll-mt-24 rounded-xl border p-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${s.cited ? 'border-primary-200 dark:border-primary-500/30' : 'border-gray-100 opacity-80 dark:border-gray-800'}`}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary-50 text-[11px] font-semibold text-primary-600 dark:bg-primary-500/20 dark:text-primary-300">{s.n}</span>
                      <FileText size={13} className="shrink-0 text-gray-400" />
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{s.title}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-xs text-gray-500">{s.snippet}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-400">
                      <span className="font-mono-ref truncate">{s.referenceNumber}</span>
                      <DocumentTypeBadge type={s.documentType} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {t.engine && (
              <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
                {t.engine.startsWith('ollama') ? <ShieldCheck size={12} /> : <Cloud size={12} />}
                Answered by {engineLabel(t.engine)}. AI can be wrong: open the sources to confirm.
              </p>
            )}
          </div>
        ))}
        {busy && <p className="w-fit rounded-2xl border border-gray-200 px-4 py-2.5 text-sm text-gray-400 dark:border-gray-800">Searching the records…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="sticky bottom-0 pb-1">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} disabled={off}
            placeholder={turns.length ? 'Ask a follow-up…' : 'What would you like to know?'}
            aria-label="Your question"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10 disabled:opacity-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white" />
          {turns.length > 0 && (
            <button type="button" onClick={() => { setTurns([]); setError('') }} title="Start over" aria-label="Start over"
              className="rounded-2xl border border-gray-200 px-3 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5"><RotateCcw size={16} /></button>
          )}
          <button type="submit" disabled={busy || off || !input.trim()} aria-label="Ask"
            className="rounded-2xl bg-primary-500 px-4 text-white hover:bg-primary-600 disabled:opacity-50"><Send size={16} /></button>
        </div>
        {status?.enabled && (
          <p className="mt-2 text-[11px] text-gray-400">
            {cloud
              ? `Passages from records classified ${status.externalMaxClassification ?? 'internal'} or lower are sent to ${status.primary?.provider}. ${status.local ? 'Higher classifications are answered on this server.' : 'Higher classifications are never sent.'}`
              : 'Questions are answered by a model running on this server.'}
          </p>
        )}
      </form>
    </div>
  )
}
