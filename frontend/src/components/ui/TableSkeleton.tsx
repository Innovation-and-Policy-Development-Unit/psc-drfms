import { memo } from 'react'

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

function TableSkeletonComponent({ rows = 5, cols = 5 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row}>
          {Array.from({ length: cols }).map((_, col) => (
            <td key={col} className="px-4 py-3">
              <div
                className="skeleton h-3.5"
                style={{ width: col === 0 ? '75%' : col === cols - 1 ? '40%' : '55%' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export const TableSkeleton = memo(TableSkeletonComponent)
