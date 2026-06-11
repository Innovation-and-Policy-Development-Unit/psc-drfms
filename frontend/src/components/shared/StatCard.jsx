import clsx from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

// Icon accent colors on the TailAdmin-style neutral icon box
const iconColors = {
  purple: 'text-primary-500 dark:text-primary-400',
  cyan: 'text-blue-light-500',
  emerald: 'text-success-500',
  amber: 'text-warning-500',
  red: 'text-error-500',
  blue: 'text-blue-light-600',
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  color = 'purple',
  suffix = '',
  prefix = '',
}) {
  const isPositive = change >= 0
  const iconColor = iconColors[color] || iconColors.purple

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 transition-all duration-200 hover:shadow-theme-md">
      {/* Icon box */}
      <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
        {Icon && <Icon size={22} className={iconColor} />}
      </div>

      <div className="flex items-end justify-between mt-5">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
          <h4 className="mt-2 text-2xl font-bold tracking-tight text-gray-800 dark:text-white/90">
            {prefix}{value}{suffix}
          </h4>
        </div>

        {change !== undefined && change !== null && (
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-theme-xs font-medium',
              isPositive
                ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
                : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
            )}
            title={changeLabel || 'vs last month'}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  )
}
