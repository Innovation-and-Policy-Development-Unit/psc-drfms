import clsx from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

const accentStyles = {
  navy: 'border-s-[3px] border-s-[var(--brand-navy)]',
  forest: 'border-s-[3px] border-s-[var(--brand-forest)]',
  warning: 'border-s-[3px] border-s-[var(--status-warning-fg)]',
  danger: 'border-s-[3px] border-s-[var(--status-danger-fg)]',
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  color = 'navy',
  suffix = '',
  prefix = '',
}) {
  const isPositive = change >= 0
  const accent = accentStyles[color] || accentStyles.navy

  return (
    <div className={clsx('panel p-5', accent)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="label-overline">{title}</p>
        {Icon && (
          <div className="w-9 h-9 rounded-registry bg-[var(--surface-sunken)] flex items-center justify-center shrink-0 text-secondary">
            <Icon size={18} />
          </div>
        )}
      </div>

      <p className="font-serif text-3xl font-semibold text-[var(--text-primary)] tracking-tight">
        {prefix}{value}{suffix}
      </p>

      {change != null && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-secondary">
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span className="font-medium">{isPositive ? '+' : ''}{change}%</span>
          <span className="text-muted">{changeLabel || 'vs last month'}</span>
        </div>
      )}
    </div>
  )
}
