import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronDown, X } from 'lucide-react'
import menuItems, { getAllPaths, flattenItems } from '../../data/menuItems'
import Logo from '../shared/Logo'

// Desktop: hover dropdown via portal
function HorizGroupItem({ group }) {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)

  const GroupIcon = group.groupIcon
  const allPaths = getAllPaths(group.items)
  const anyActive = allPaths.includes(location.pathname)
  const flatItems = flattenItems(group.items)

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const isRtl = document.documentElement.dir === 'rtl'
      const dropdownWidth = 220
      const maxH = window.innerHeight - rect.bottom - 8

      const style = {
        position: 'fixed',
        zIndex: 9999,
        top: `${rect.bottom + 4}px`,
        maxHeight: `${Math.max(maxH, 200)}px`,
      }

      if (isRtl) {
        const right = window.innerWidth - rect.right
        style.right = `${Math.max(0, right)}px`
      } else {
        const left = rect.left
        style.left = `${Math.min(left, window.innerWidth - dropdownWidth - 8)}px`
      }

      setDropdownStyle(style)
    }
  }, [open])

  if (group.items.length === 1 && group.items[0].path) {
    return (
      <NavLink
        to={group.items[0].path}
        className={({ isActive }) => clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap',
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={16} />
        {group.group}
      </NavLink>
    )
  }

  return (
    <div
      className="relative"
      ref={triggerRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={clsx(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap',
          open || anyActive
            ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={16} />
        {group.group}
        <ChevronDown size={13} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          style={dropdownStyle}
          className="min-w-[200px] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 animate-fade-in"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {flatItems.map((entry, i) => {
            if (entry.type === 'header') {
              return (
                <div key={`h-${i}`} className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-slate-100 dark:border-slate-700 mt-1 first:border-0 first:mt-0">
                  {entry.label}
                </div>
              )
            }
            const ItemIcon = entry.icon
            return (
              <NavLink
                key={entry.path}
                to={entry.path}
                onClick={() => setOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-sm transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ItemIcon size={15} />
                <span>{entry.label}</span>
              </NavLink>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// Mobile: individual nav items matching sidebar expanded style
function MobileNavItem({ item, onClose }) {
  const location = useLocation()
  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => c.path === location.pathname)
  })

  const hasChildren = !!item.children
  const Icon = item.icon

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
        onClick={onClose}
        className={({ isActive }) => clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150',
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <Icon size={18} className="shrink-0" />
        <span>{item.label}</span>
      </NavLink>
    )
  }

  const anyChildActive = item.children.some(c => c.path === location.pathname)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150',
          anyChildActive
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <Icon size={18} className="shrink-0" />
        <span className="flex-1 text-start">{item.label}</span>
        <ChevronDown
          size={15}
          className={clsx('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="mt-1 ms-4 ps-3 border-s border-slate-200 dark:border-slate-700 space-y-0.5">
          {item.children.map(child => {
            const ChildIcon = child.icon
            return (
              <NavLink
                key={child.path}
                to={child.path}
                onClick={onClose}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ChildIcon size={15} className="shrink-0" />
                <span>{child.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function HorizontalMenu({ mobileOpen, onMobileClose }) {
  return (
    <>
      {/* Desktop horizontal bar */}
      <div className="hidden lg:flex fixed top-16 start-0 end-0 h-12 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-20 items-center px-4 gap-1 overflow-x-auto scrollbar-hide">
        {menuItems.map(group => (
          <HorizGroupItem key={group.group} group={group} />
        ))}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={clsx(
          'fixed top-0 start-0 h-full w-64 bg-white dark:bg-slate-800 border-e border-slate-200 dark:border-slate-700 z-30 flex flex-col transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <Logo size={32} />
            <div>
              <span className="font-bold text-lg text-primary-500 dark:text-slate-300">PSC-DRFMS</span>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 -mt-1 font-medium tracking-wider uppercase">Menu</span>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 space-y-0.5">
          {menuItems.map(group => (
            <div key={group.group} className="mb-2">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {group.group}
              </div>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <MobileNavItem key={item.path || item.label} item={item} onClose={onMobileClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
