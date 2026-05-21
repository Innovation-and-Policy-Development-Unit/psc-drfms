import { NavLink } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import SeriesTree from './SeriesTree'
import clsx from 'clsx'
import {
  Home, FolderOpen, Clock, Upload, Search, Share2,
  CheckCircle, Shield, BarChart3, Settings, Users, Star,
} from 'lucide-react'

const mainNav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/browse', label: 'All files', icon: FolderOpen },
  { to: '/starred', label: 'Starred', icon: Star },
  { to: '/shared-with-me', label: 'Shared with me', icon: Users },
  { to: '/recent', label: 'Recent', icon: Clock },
  { to: '/upload', label: 'Upload', icon: Upload },
  { to: '/search', label: 'Search', icon: Search },
]

const moreNav = [
  { to: '/workflows/my-tasks', label: 'Approvals', icon: CheckCircle },
  { to: '/sharing', label: 'Shared links', icon: Share2 },
  { to: '/compliance/legal-holds', label: 'Governance', icon: Shield },
  { to: '/analytics', label: 'Insights', icon: BarChart3 },
  { to: '/admin/users', label: 'Admin', icon: Users },
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => clsx(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
      )}
    >
      <Icon size={18} className="shrink-0 opacity-80" />
      {label}
    </NavLink>
  )
}

export default function DriveSidebar({ onNavigate }) {
  const { openSettingsPanel } = useTheme()
  const handleClick = () => onNavigate?.()

  return (
    <aside className="w-60 shrink-0 flex flex-col border-e border-slate-200 dark:border-slate-700 bg-[#f5f5f5] dark:bg-slate-900 h-full">
      <nav className="shrink-0 overflow-y-auto custom-scrollbar p-3 space-y-1 max-h-[45vh]" onClick={handleClick}>
        <p className="px-3 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Documents
        </p>
        {mainNav.map(item => (
          <NavItem key={item.to} {...item} />
        ))}

        <p className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          More
        </p>
        {moreNav.map(item => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border-t border-slate-200 dark:border-slate-700">
        <SeriesTree onNavigate={onNavigate} />
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
        <button
          type="button"
          onClick={() => { openSettingsPanel(); handleClick() }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/60"
        >
          <Settings size={18} />
          Settings
        </button>
      </div>
    </aside>
  )
}
