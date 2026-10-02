/**
 * Appearance presets and the code that applies them.
 *
 * A preset is one brand colour. We derive the 50-900 scale from it, set the
 * `--p-*` variables Tailwind's `primary-*` utilities read, and derive the
 * handful of `--brand-*` tokens the older components use. Every preset's base
 * colour keeps white text above WCAG AA (4.5:1), so buttons stay legible.
 */

export type Mode = 'light' | 'dark' | 'system'
export type Density = 'compact' | 'comfortable'
export type Radius = 'sharp' | 'default' | 'round'

export interface Prefs {
  theme: string
  mode: Mode
  density: Density
  radius: Radius
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'psc-blue',
  mode: 'light',
  density: 'comfortable',
  radius: 'default',
}

type RGB = [number, number, number]

export interface ThemePreset {
  id: string
  name: string
  description: string
  base: string
  /** Hand-tuned scale; otherwise derived from `base`. */
  scale?: RGB[]
}

const PSC_BLUE: RGB[] = [
  [236, 243, 255], [221, 233, 255], [194, 214, 255], [156, 185, 255], [117, 146, 255],
  [70, 95, 255], [54, 65, 245], [42, 49, 216], [37, 45, 174], [38, 46, 137],
]

export const THEMES: ThemePreset[] = [
  { id: 'psc-blue', name: 'PSC Blue', description: 'Official default', base: '#465fff', scale: PSC_BLUE },
  { id: 'ocean', name: 'Ocean', description: 'Calm, clear blue', base: '#0369a1' },
  { id: 'violet', name: 'Violet', description: 'Deep purple', base: '#6d28d9' },
  { id: 'emerald', name: 'Emerald', description: 'Fresh, steady green', base: '#047857' },
  { id: 'teal', name: 'Teal', description: 'Cool blue-green', base: '#0f766e' },
  { id: 'amber', name: 'Amber', description: 'Warm earth tones', base: '#b45309' },
  { id: 'rose', name: 'Rose', description: 'Soft crimson', base: '#be123c' },
  { id: 'graphite', name: 'Graphite', description: 'Neutral and understated', base: '#334155' },
]

export function themeById(id: string | undefined): ThemePreset {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// --- colour maths ----------------------------------------------------------

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
}

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]

/** The 50-900 scale for a preset (10 entries, index 5 is the base colour). */
export function scaleFor(theme: ThemePreset): RGB[] {
  if (theme.scale) return theme.scale
  const base = hexToRgb(theme.base)
  const tints = [0.93, 0.85, 0.7, 0.52, 0.28].map((t) => mix(base, WHITE, t))
  const shades = [0.12, 0.26, 0.4, 0.52].map((t) => mix(base, BLACK, t))
  return [...tints, base, ...shades]
}

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG contrast ratio of white text on the preset's base colour. */
export function contrastWithWhite(theme: ThemePreset): number {
  const l = luminance(scaleFor(theme)[5])
  return 1.05 / (l + 0.05)
}

const rgbVar = ([r, g, b]: RGB) => `${r} ${g} ${b}`
const rgbHex = ([r, g, b]: RGB) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r}, ${g}, ${b}, ${a})`

/** Colours the panel uses to draw a preset's preview card. */
export function previewColors(theme: ThemePreset, isDark: boolean) {
  const s = scaleFor(theme)
  const accent = isDark ? s[4] : s[5]
  return { accent: rgbHex(accent), soft: rgbHex(isDark ? mix(s[5], BLACK, 0.55) : s[1]), strong: rgbHex(s[7]) }
}

// --- applying --------------------------------------------------------------

const RADIUS_TOKENS: Record<Radius, [string, string, string]> = {
  sharp: ['4px', '6px', '8px'],
  default: ['8px', '12px', '16px'],
  round: ['12px', '16px', '24px'],
}

export function applyAppearance(prefs: Pick<Prefs, 'theme' | 'density' | 'radius'>, isDark: boolean) {
  const root = document.documentElement
  const s = scaleFor(themeById(prefs.theme))

  // In dark mode the brand colour steps one shade lighter so it reads on dark surfaces.
  const p: RGB[] = isDark ? [...s.slice(0, 4), s[3], s[4], s[5], ...s.slice(7)] : s
  const names = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
  names.forEach((n, i) => root.style.setProperty(`--p-${n}`, rgbVar(p[i])))

  root.style.setProperty('--brand-primary', rgbHex(s[5]))
  root.style.setProperty('--brand-primary-hover', rgbHex(s[6]))
  root.style.setProperty('--brand-navy', rgbHex(isDark ? p[5] : s[5]))
  root.style.setProperty('--brand-navy-muted', rgbHex(isDark ? s[5] : s[6]))
  root.style.setProperty('--brand-accent', rgbHex(isDark ? p[5] : s[5]))
  root.style.setProperty('--brand-primary-muted', isDark ? rgba(s[5], 0.12) : rgbHex(s[0]))
  root.style.setProperty('--surface-sidebar-active', isDark ? rgba(s[5], 0.12) : rgbHex(s[0]))

  const [sm, md, lg] = RADIUS_TOKENS[prefs.radius]
  root.style.setProperty('--radius-sm', sm)
  root.style.setProperty('--radius-md', md)
  root.style.setProperty('--radius-lg', lg)

  root.classList.toggle('dark', isDark)
  root.dataset.theme = prefs.theme
  root.dataset.density = prefs.density
  root.dataset.radius = prefs.radius
}
