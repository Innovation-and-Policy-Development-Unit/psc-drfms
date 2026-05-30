import { memo, type InputHTMLAttributes } from 'react'
import clsx from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
}

function InputComponent({ label, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-secondary">
          {label}
        </label>
      )}
      <input id={inputId} className={clsx('input', className)} {...props} />
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export const Input = memo(InputComponent)
