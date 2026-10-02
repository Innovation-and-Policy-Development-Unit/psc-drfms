import { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Lock, Monitor, Moon, RotateCcw, Search, Sun, X } from 'lucide-react'
import clsx from 'clsx'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import { appearanceApi } from '@/api/appearance'
import {
  THEMES, contrastWithWhite, previewColors,
  type Density, type Mode, type Prefs, type Radius, type ThemePreset,
} from '@/lib/themes'

const MODES: Array<{ id: Mode; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
]
const DENSITIES: Array<{ id: Density; label: string }> = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
]
const RADII: Array<{ id: Radius; label: string }> = [
  { id: 'sharp', label: 'Sharp' },
  { id: 'default', label: 'Default' },
  { id: 'round', label: 'Round' },
]

function Segmented<T extends string>({ value, options, onChange, disabled }: {
  value: T
  options: Array<{ id: T; label: string; icon?: typeof Sun }>
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className={clsx('grid gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/5', options.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(id)}
          className={clsx(
            'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50',
            value === id
              ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
          )}
          aria-pressed={value === id}
        >
          {Icon && <Icon size={14} />} {label}
        </button>
      ))}
    </div>
  )
}

function ThemeCard({ theme, selected, isDark, disabled, onPick }: {
  theme: ThemePreset
  selected: boolean
  isDark: boolean
  disabled: boolean
  onPick: () => void
}) {
  const c = previewColors(theme, isDark)
  const aa = contrastWithWhite(theme) >= 4.5
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      className={clsx(
        'group relative rounded-2xl border p-2.5 text-start transition-all disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-primary-500 ring-2 ring-primary-500/20'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700',
      )}
    >
      {/* Mini interface preview drawn in the preset's own colours */}
      <div className={clsx('flex h-16 overflow-hidden rounded-lg border', isDark ? 'border-gray-800 bg-gray-950' : 'border-gray-100 bg-gray-50')}>
        <div className={clsx('w-6 shrink-0 space-y-1 p-1', isDark ? 'bg-gray-900' : 'bg-white')}>
          <span className="block h-1.5 rounded-sm" style={{ background: c.accent }} />
          <span className={clsx('block h-1 rounded-sm', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
          <span className={clsx('block h-1 rounded-sm', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
        </div>
        <div className="flex-1 space-y-1.5 p-1.5">
          <span className="block h-2 w-2/3 rounded-sm" style={{ background: c.accent }} />
          <span className="block h-1.5 w-1/2 rounded-sm" style={{ background: c.soft }} />
          <div className="flex gap-1">
            <span className="block h-3 w-5 rounded-sm" style={{ background: c.strong }} />
            <span className="block h-3 w-5 rounded-sm" style={{ background: c.accent }} />
            <span className="block h-3 w-5 rounded-sm" style={{ background: c.soft }} />
          </div>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
        {theme.name}
        {!aa && <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">low contrast</span>}
      </p>
      <p className="truncate text-xs text-gray-400">{theme.description}</p>
      {selected && (
        <span className="absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white">
          <Check size={12} />
        </span>
      )}
    </button>
  )
}

function SettingsPanelComponent() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { prefs, isDark, locked, org, personal, setPref, resetPersonal, setOrg, settingsPanelOpen, closeSettingsPanel } = useTheme()
  const isAdmin = user?.role === 'administrator'
  const [scope, setScope] = useState<'me' | 'org'>('me')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!settingsPanelOpen) { setScope('me'); setQuery(''); setError('') }
  }, [settingsPanelOpen])

  useEffect(() => {
    if (!settingsPanelOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettingsPanel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsPanelOpen, closeSettingsPanel])

  const editingOrg = isAdmin && scope === 'org'
  // What the cards/segments show as selected, and whether they can be changed
  const shown: Prefs = editingOrg && org ? { theme: org.theme, mode: org.mode, density: org.density, radius: org.radius } : prefs
  const controlsDisabled = editingOrg ? busy : locked
  const themes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? THEMES.filter((th) => `${th.name} ${th.description}`.toLowerCase().includes(q)) : THEMES
  }, [query])

  if (!settingsPanelOpen) return null

  const change = async (patch: Partial<Prefs>) => {
    if (!editingOrg) { setPref(patch); return }
    setBusy(true)
    setError('')
    try {
      const { data } = await appearanceApi.saveOrg(patch)
      setOrg(data)
    } catch {
      setError('Could not save the organisation default.')
    } finally {
      setBusy(false)
    }
  }

  const toggleLock = async () => {
    if (!org) return
    setBusy(true)
    setError('')
    try {
      const { data } = await appearanceApi.saveOrg({ locked: !org.locked })
      setOrg(data)
    } catch {
      setError('Could not change the lock.')
    } finally {
      setBusy(false)
    }
  }

  const hasPersonal = Object.keys(personal).length > 0

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-[1px]" onClick={closeSettingsPanel} aria-hidden />
      <aside
        className="fixed end-0 top-0 z-50 flex h-full w-full max-w-sm animate-slide-in-right flex-col border-s border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
        role="dialog"
        aria-label="Appearance"
      >
        <div className="flex items-start justify-between px-5 pb-3 pt-5">
          <div>
            <h2 className="font-sans text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
            <p className="mt-0.5 text-sm text-gray-500">Choose how the interface looks</p>
          </div>
          <button type="button" onClick={closeSettingsPanel} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5 custom-scrollbar">
          {isAdmin && (
            <div>
              <Segmented<'me' | 'org'>
                value={scope}
                options={[{ id: 'me', label: 'Just me' }, { id: 'org', label: 'Everyone' }]}
                onChange={setScope}
              />
              {editingOrg && (
                <p className="mt-2 text-xs text-gray-500">
                  Sets the default for everyone. People who picked their own look keep it unless you lock the appearance.
                </p>
              )}
            </div>
          )}

          {locked && !editingOrg && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Lock size={16} className="mt-0.5 shrink-0" />
              <span>The look of this system is set by your administrator{isAdmin ? ' (switch to “Everyone” to change or unlock it)' : ''}.</span>
            </div>
          )}

          <div className="relative">
            <Search size={15} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search themes…"
              className="h-10 w-full rounded-xl border border-gray-200 bg-white ps-10 pe-3 text-sm placeholder:text-gray-400 focus:border-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white"
              aria-label="Search themes"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {themes.map((th) => (
              <ThemeCard
                key={th.id}
                theme={th}
                selected={shown.theme === th.id}
                isDark={isDark}
                disabled={controlsDisabled}
                onPick={() => change({ theme: th.id })}
              />
            ))}
            {themes.length === 0 && <p className="col-span-2 py-6 text-center text-sm text-gray-400">No theme matches “{query}”.</p>}
          </div>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 font-sans">Colour mode</p>
            <Segmented value={shown.mode} options={MODES} onChange={(mode) => change({ mode })} disabled={controlsDisabled} />
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 font-sans">Density</p>
            <Segmented value={shown.density} options={DENSITIES} onChange={(density) => change({ density })} disabled={controlsDisabled} />
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 font-sans">Corners</p>
            <Segmented value={shown.radius} options={RADII} onChange={(radius) => change({ radius })} disabled={controlsDisabled} />
          </section>

          {editingOrg && org && (
            <section className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white"><Lock size={14} /> Lock appearance for everyone</span>
                  <span className="mt-0.5 block text-xs text-gray-500">Everyone sees this look and cannot change it.</span>
                </span>
                <input type="checkbox" className="peer sr-only" checked={org.locked} onChange={toggleLock} disabled={busy} />
                <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-gray-200 transition-colors after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-primary-500 peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4 dark:bg-gray-700" />
              </label>
            </section>
          )}

          {!editingOrg && (
            <section>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400 font-sans">{t('settings.language')}</p>
              <Segmented
                value={(['en', 'fr', 'bi'].includes(i18n.language) ? i18n.language : 'en') as 'en' | 'fr' | 'bi'}
                options={[{ id: 'en', label: 'EN' }, { id: 'fr', label: 'FR' }, { id: 'bi', label: 'BI' }]}
                onChange={(code) => i18n.changeLanguage(code)}
              />
            </section>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          {!editingOrg && (
            <button
              type="button"
              onClick={() => { resetPersonal(); appearanceApi.resetMine().catch(() => {}) }}
              disabled={locked || !hasPersonal}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-gray-200"
            >
              <RotateCcw size={14} /> Reset to organisation default
            </button>
          )}
          <p className="mt-2 text-xs text-gray-400">
            {editingOrg ? 'Saved for everyone as you change it.' : 'Your choice is saved to your account and follows you to other devices.'}
          </p>
        </div>
      </aside>
    </>
  )
}

export const SettingsPanel = memo(SettingsPanelComponent)
