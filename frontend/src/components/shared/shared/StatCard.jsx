import clsx from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

const solidColors = {
  purple: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
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
  const solidColor = solidColors[color] || solidColors.purple

  return (
    <div className={clsx(
      'relative rounded-2xl p-5 overflow-hidden text-white shadow-card-md hover:shadow-card-lg transition-all duration-200 hover:-translate-y-0.5',
      solidColor
    )}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <div className="w-full h-full rounded-full bg-white transform translate-x-8 -translate-y-8" />
      </div>
      <div className="absolute bottom-0 left-0 w-20 h-20 opacity-10">
        <div className="w-full h-full rounded-full bg-white transform -translate-x-6 translate-y-6" />
      </div>

      <div className="relative">
        {/* Icon and title */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{title}</p>
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            {Icon && <Icon size={20} className="text-white" />}
          </div>
        </div>

        {/* Value */}
        <div className="mb-3">
          <p className="text-3xl font-bold tracking-tight">
            {prefix}{value}{suffix}
          </p>
        </div>

        {/* Change indicator */}
        <div className="flex items-center gap-1.5">
          <div className={clsx(
            'flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full',
            isPositive ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
          )}>
            {isPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>{isPositive ? '+' : ''}{change}%</span>
          </div>
          <span className="text-white/60 text-xs">{changeLabel || 'vs last month'}</span>
        </div>
      </div>
    </div>
  )
}
