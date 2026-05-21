import { useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'

const presetColors = {
  navy:   { hex: '#004276', light: '#468cc8' },
  blue:   { hex: '#3b82f6', light: '#93bbfd' },
  green:  { hex: '#10b981', light: '#6ee7b7' },
  orange: { hex: '#f97316', light: '#fdba74' },
  red:    { hex: '#f43f5e', light: '#fda4af' },
}

export default function useChartColors() {
  const { colorPreset, isDark } = useTheme()

  return useMemo(() => {
    const preset = presetColors[colorPreset] || presetColors.navy
    const primary = isDark ? preset.light : preset.hex

    return {
      primary,
      cyan:    isDark ? '#67e8f9' : '#06b6d4',
      emerald: isDark ? '#6ee7b7' : '#10b981',
      amber:   isDark ? '#fcd34d' : '#f59e0b',
      rose:    isDark ? '#fda4af' : '#f43f5e',
      violet:  isDark ? '#c4b5fd' : '#8b5cf6',
      grid:    isDark ? '#334155' : '#e2e8f0',
      axis:    isDark ? '#64748b' : '#94a3b8',
      bg:      isDark ? '#1e293b' : '#f1f5f9',
    }
  }, [colorPreset, isDark])
}
