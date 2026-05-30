import { memo } from 'react'
import clsx from 'clsx'

interface SkeletonProps {
  className?: string
  lines?: number
}

function SkeletonComponent({ className, lines = 1 }: SkeletonProps) {
  if (lines <= 1) {
    return <div className={clsx('skeleton-block', className)} aria-hidden />
  }
  return (
    <div className="space-y-2 skeleton-stagger" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx('skeleton-block h-3', i === lines - 1 && 'w-3/4')}
        />
      ))}
    </div>
  )
}

export const Skeleton = memo(SkeletonComponent)
