import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { appearanceApi } from '@/api/appearance'

/**
 * Keeps the look in step with the server once someone is signed in:
 * loads the organisation default (and any lock) plus the person's saved choice,
 * and saves their later changes so they follow them to other devices.
 * Renders nothing.
 */
export default function AppearanceSync() {
  const { user } = useAuth()
  const { hydrate, hydrated, personal, locked } = useTheme()

  useEffect(() => {
    if (!user) return
    let cancelled = false
    appearanceApi.get()
      .then(({ data }) => { if (!cancelled) hydrate(data.org, data.user) })
      .catch(() => { /* offline or older server: the local choice still applies */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  const serialised = JSON.stringify(personal)
  useEffect(() => {
    if (!hydrated || locked || serialised === '{}') return
    const timer = setTimeout(() => {
      appearanceApi.saveMine(JSON.parse(serialised)).catch(() => { /* retried on the next change */ })
    }, 500)
    return () => clearTimeout(timer)
  }, [serialised, hydrated, locked])

  return null
}
