import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import type { BreadcrumbItem } from '@/types/api'

interface DriveBreadcrumbsProps {
  items?: BreadcrumbItem[]
}

export default function DriveBreadcrumbs({ items = [] }: DriveBreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted flex-wrap mb-3">
      <Link to="/" className="hover:text-primary-600 flex items-center gap-1">
        <Home size={14} />
        <span>Home</span>
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={14} className="text-slate-300" />
          {item.to ? (
            <Link to={item.to} className="hover:text-primary-600 text-slate-700 dark:text-slate-300">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-800 dark:text-slate-200 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
