import clsx from 'clsx'

// TailAdmin light-variant badge colors
const variants = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
  danger: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500',
  info: 'bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-500',
  secondary: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
  purple: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
}

export default function Badge({ children, variant = 'secondary', className = '', dot = false }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-theme-xs font-medium',
      variants[variant],
      className
    )}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  )
}
