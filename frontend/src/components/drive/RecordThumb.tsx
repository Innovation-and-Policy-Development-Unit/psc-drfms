import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { driveApi } from '@/api/drive'

// Object URLs by "record:modified". null = this file has no thumbnail (remembered for the session).
const cache = new Map<string, string | null>()

// A page of tiles would otherwise fire dozens of renders at once
const MAX_PARALLEL = 4
let running = 0
const waiting: Array<() => void> = []

function limited<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      running += 1
      job().then(resolve, reject).finally(() => {
        running -= 1
        waiting.shift()?.()
      })
    }
    if (running < MAX_PARALLEL) start()
    else waiting.push(start)
  })
}

export function hasThumbnail(mimeType?: string) {
  const mime = (mimeType ?? '').toLowerCase()
  return mime.includes('pdf') || mime.startsWith('image/')
}

interface Props {
  recordId: string
  /** Changes when the file changes, so a new version gets a fresh thumbnail. */
  version?: string
  mimeType?: string
  alt?: string
  className?: string
  /** Shown while loading and when the file type has no thumbnail. */
  fallback: ReactNode
}

/** First-page preview, fetched only when scrolled into view. Falls back to `fallback` (the type icon). */
function RecordThumbComponent({ recordId, version = '', mimeType, alt = '', className, fallback }: Props) {
  const key = `${recordId}:${version}`
  const supported = hasThumbnail(mimeType)
  const [src, setSrc] = useState<string | null>(() => cache.get(key) ?? null)
  const holder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supported) return
    if (cache.has(key)) { setSrc(cache.get(key) ?? null); return }
    const el = holder.current
    if (!el) return
    let cancelled = false
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      limited(() => driveApi.thumbnail(recordId))
        .then((res) => {
          const url = res.status === 200 && res.data.size > 0 ? URL.createObjectURL(res.data) : null
          cache.set(key, url)
          if (!cancelled) setSrc(url)
        })
        .catch(() => { /* leave the icon; a later visit retries */ })
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => { cancelled = true; observer.disconnect() }
  }, [key, recordId, supported])

  return (
    <div ref={holder} className={className}>
      {src ? <img src={src} alt={alt} loading="lazy" draggable={false} className="h-full w-full object-cover object-top" /> : fallback}
    </div>
  )
}

export const RecordThumb = memo(RecordThumbComponent)
