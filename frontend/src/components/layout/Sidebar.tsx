import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import menuItems, { getAllPaths, flattenItems, isGroupActive, isPathActive } from '@/data/menuItems'
import Logo from '../shared/Logo'


// Collapsed sidebar: one icon per group with tap/click flyout (portal)
function CollapsedGroupItem({ group }) {
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const triggerRef = useRef(null)

  const GroupIcon = group.groupIcon
  const allPaths = getAllPaths(group.items)
  const anyActive = isGroupActive(allPaths, location.pathname)
  const flatItems = flattenItems(group.items)

  const positionDropdown = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const dropdownHeight = flatItems.length * 38 + 56
    const spaceBelow = window.innerHeight - rect.top
    const isRtl = document.documentElement.dir === 'rtl'
    const style: CSSProperties = { position: 'fixed', zIndex: 9999 }
    if (isRtl) {
      style.right = `${window.innerWidth - rect.left + 4}px`
    } else {
      style.left = `${rect.right + 4}px`
    }
    const maxH = window.innerHeight - 16
    if (spaceBelow >= dropdownHeight) {
      style.top = `${rect.top}px`
      style.maxHeight = `${window.innerHeight - rect.top - 8}px`
    } else if (rect.bottom >= dropdownHeight) {
      style.bottom = `${window.innerHeight - rect.bottom}px`
      style.maxHeight = `${rect.bottom - 8}px`
    } else {
      style.top = '8px'
      style.maxHeight = `${maxH}px`
    }
    setDropdownStyle(style)
  }

  const open = () => { positionDropdown(); setDropdownOpen(true) }
  const close = () => setDropdownOpen(false)

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [dropdownOpen])

  // If group has only one item with a direct path, make it a direct link
  if (group.items.length === 1 && group.items[0].path) {
    return (
      <NavLink
        to={group.items[0].path}
        className={({ isActive }) => clsx(
          'flex flex-col items-center gap-0.5 px-1 py-2.5 rounded-lg font-medium transition-all duration-150',
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={20} className="shrink-0" />
        <span className="text-[10px] leading-tight text-center truncate w-full">{group.group}</span>
      </NavLink>
    )
  }

  return (
    <div ref={triggerRef}>
      <button
        onClick={() => dropdownOpen ? close() : open()}
        aria-expanded={dropdownOpen}
        className={clsx(
          'w-full flex flex-col items-center gap-0.5 px-1 py-2.5 rounded-lg font-medium transition-all duration-150',
          anyActive || dropdownOpen
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
        )}
      >
        <GroupIcon size={20} className="shrink-0" />
        <span className="text-[10px] leading-tight text-center truncate w-full">{group.group}</span>
      </button>

      {dropdownOpen && createPortal(
        <div
          style={dropdownStyle}
          className="min-w-[200px] max-h-[70vh] overflow-y-auto custom-scrollbar panel py-2 animate-registry-in"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            {group.group}
          </div>
          {flatItems.map((entry, i) => {
            if (entry.type === 'header') {
              return (
                <div key={`h-${i}`} className="px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-slate-100 dark:border-slate-700 mt-1">
                  {entry.label}
                </div>
              )
            }
            const ItemIcon = entry.icon
            return (
              <NavLink
                key={entry.path}
                to={entry.path}
                onClick={close}
                className={({ isActive }) => clsx(
                  'flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-md text-sm transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ItemIcon size={15} className="shrink-0" />
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

// Expanded sidebar: individual items with accordion for children
function NavItem({ item }) {
  const location = useLocation()
  const [open, setOpen] = useState(() => {
    if (!item.children) return false
    return item.children.some(c => isPathActive(c.path, location.pathname))
  })

  const hasChildren = !!item.children
  const Icon = item.icon

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
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

  const anyChildActive = item.children.some(c => isPathActive(c.path, location.pathname))

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
          className={clsx(
            'transition-transform duration-200',
            open && 'rotate-180'
          )}
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

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { user } = useAuth()
  const collapsed = false
  const role = user?.role ?? 'read_only'
  const visibleGroups = menuItems.filter(g => !g.roles || g.roles.includes(role))

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 start-0 h-full bg-white dark:bg-slate-800 border-e border-slate-200 dark:border-slate-700 z-30 flex flex-col sidebar-transition overflow-hidden',
          collapsed ? 'w-[5.5rem]' : 'w-64',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 rtl:lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-16 border-b border-slate-200 dark:border-slate-700 shrink-0',
          collapsed ? 'justify-center px-3' : 'px-5 gap-3'
        )}>
          <Logo size={32} />
          {!collapsed && (
            <div>
              <span className="font-bold text-lg text-primary-500 dark:text-slate-300">Liner</span>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 -mt-1 font-medium tracking-wider uppercase">Admin</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 space-y-0.5">
          {collapsed ? (
            /* Collapsed: group icons with flyout */
            <div className="space-y-1">
              {visibleGroups.map(group => (
                <CollapsedGroupItem key={group.group} group={group} />
              ))}
            </div>
          ) : (
            /* Expanded: full menu with groups */
            visibleGroups.map(group => (
              <div key={group.group} className="mb-2">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {group.group}
                </div>
                <div className="space-y-0.5">
                  {group.items
                    .filter(item => !item.roles || item.roles.includes(role))
                    .map(item => (
                      <NavItem key={item.path || item.label} item={item} />
                    ))}
                </div>
              </div>
            ))
          )}
        </nav>

        {/* Bottom user info */}
        {!collapsed && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                <span className="text-white font-semibold text-sm">JD</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">John Doe</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">john@liner.com</p>
              </div>
              <ChevronRight size={14} className="text-slate-400 shrink-0 rtl:rotate-180" />
            </div>
          </div>
        )}

        {collapsed && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center mx-auto cursor-pointer">
              <span className="text-white font-semibold text-sm">JD</span>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
