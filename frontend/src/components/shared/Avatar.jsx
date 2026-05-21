import clsx from 'clsx'

const sizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

const solidColors = [
  'bg-indigo-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-blue-500',
]

function getSolidColor(name) {
  if (!name) return solidColors[0]
  const code = name.charCodeAt(0) % solidColors.length
  return solidColors[code]
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({
  name,
  src,
  size = 'md',
  className = '',
  status,
}) {
  const sizeClass = sizes[size] || sizes.md
  const solidColor = getSolidColor(name)

  return (
    <div className={clsx('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={clsx('rounded-full object-cover', sizeClass)}
        />
      ) : (
        <div className={clsx(
          'rounded-full flex items-center justify-center text-white font-semibold',
          sizeClass,
          solidColor
        )}>
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span className={clsx(
          'absolute bottom-0 end-0 rounded-full border-2 border-white dark:border-slate-800',
          size === 'xs' ? 'w-1.5 h-1.5' : 'w-2.5 h-2.5',
          status === 'online' && 'bg-emerald-500',
          status === 'offline' && 'bg-slate-400',
          status === 'busy' && 'bg-red-500',
          status === 'away' && 'bg-amber-500',
        )} />
      )}
    </div>
  )
}
