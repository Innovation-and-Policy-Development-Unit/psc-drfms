import { useMemo } from 'react'
import { useTheme } from '@/context/ThemeContext'

/** Chart palette derived from Registry tokens — no swappable color presets. */
export default function useChartColors() {
  const { isDark } = useTheme()

  return useMemo(() => {
    const primary = isDark ? 'rgb(91, 155, 213)' : '#004276'
    const forest = isDark ? '#3D9970' : '#1B6B4A'

    return {
      primary,
      secondary: forest,
      cyan: primary,
      emerald: forest,
      amber: isDark ? '#D4A72C' : '#9A6700',
      rose: isDark ? '#E57373' : '#9B2335',
      violet: primary,
      grid: isDark ? '#2E2E2B' : '#E3E1DC',
      axis: isDark ? '#9C9C96' : '#6B6B66',
      bg: isDark ? '#1C1C1A' : '#EFEEEA',
    }
  }, [isDark])
}
