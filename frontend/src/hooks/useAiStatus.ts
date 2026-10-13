import { useEffect, useState } from 'react'
import { aiApi, type AiStatus } from '@/api/ai'

let cached: Promise<AiStatus | null> | null = null

/** Whether AI is configured, fetched once per page load. `null` while loading or unavailable. */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null)
  useEffect(() => {
    cached ??= aiApi.status().then((r) => r.data).catch(() => null)
    let live = true
    cached.then((s) => { if (live) setStatus(s) })
    return () => { live = false }
  }, [])
  return status
}

/** Short label for who read the text, e.g. "Claude on a cloud service" vs "on this server". */
export function engineLabel(engine: string | undefined | null): string {
  if (!engine) return 'on-server rules'
  const [provider, model] = engine.split(':')
  return provider === 'ollama' ? `${model} (on this server)` : `${model} (${provider} cloud)`
}
