import { memo, type ReactNode } from 'react'
import clsx from 'clsx'

interface TableProps {
  children: ReactNode
  className?: string
  wrapperClassName?: string
}

function TableComponent({ children, className, wrapperClassName }: TableProps) {
  return (
    <div className={clsx('panel p-0 overflow-x-auto', wrapperClassName)}>
      <table className={clsx('registry-table', className)}>{children}</table>
    </div>
  )
}

function TableHeadComponent({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>
}

function TableBodyComponent({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>
}

export const Table = memo(TableComponent)
export const TableHead = memo(TableHeadComponent)
export const TableBody = memo(TableBodyComponent)
