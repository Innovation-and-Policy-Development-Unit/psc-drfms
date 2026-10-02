import { useState, useRef, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { useAuth } from '@/context/AuthContext'
import clsx from 'clsx'
import { ChevronDown, LogOut, Tag } from 'lucide-react'
import menuItems, { getAllPaths, flattenItems, isGroupActive, isPathActive } from '@/data/menuItems'
import Logo from '../shared/Logo'
import { useSidebarCounts } from '@/hooks/useSidebarCounts'
import * as recordsApi from '@/api/records'


function CountBadge({ n, dot = false }: { n?: number; dot?: boolean }) {
  if (!n) return null
  if (dot) return <span className="absolute end-2 top-1.5 h-2 w-2 rounded-full bg-red-500" aria-label={`${n} waiting`} />
  return (
    <span className="ms-auto min-w-[1.25rem] rounded-full bg-primary-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white tabular-nums">
      {n > 99 ? '99+' : n}
    </span>
  )
}

// Most-used tags as quick filters; the full list lives on the Tags page
function SidebarTags() {
  const [tags, setTags] = useState<Array<{ tag: string; count: number }>>([])
  const location = useLocation()
  useEffect(() => {
    let cancelled = false
    recordsApi.getTags()
      .then(({ data }) => { if (!cancelled) setTags(data.slice(0, 8)) })
      .catch(() => { /* the section simply stays empty */ })
    return () => { cancelled = true }
  }, [location.pathname])
  if (tags.length === 0) return null
  const active = new URLSearchParams(location.search).get('tag')
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        <span>Tags</span>
        <NavLink to="/tags" className="normal-case tracking-normal font-medium text-primary-500 hover:text-primary-600">All</NavLink>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3">
        {tags.map((t) => (
          <NavLink
            key={t.tag}
            to={`/browse?tag=${encodeURIComponent(t.tag)}`}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              location.pathname === '/browse' && active === t.tag
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10',
            )}
          >
            <Tag size={10} /> {t.tag}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

// Collapsed sidebar: one icon per group with tap/click flyout (portal)
function CollapsedGroupItem({ group, counts }) {
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({})
  const triggerRef = useRef(null)

  const GroupIcon = group.groupIcon
  const allPaths = getAllPaths(group.items)
  const anyActive = isGroupActive(allPaths, location.pathname)
  const flatItems = flattenItems(group.items)
  const waiting = group.items.reduce((n, i) => n + (i.badge ? counts[i.badge] ?? 0 : 0), 0)

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
          'relative flex flex-col items-center gap-0.5 px-1 py-2.5 rounded-lg font-medium transition-all duration-150',
          isActive
            ? 'bg-primary-50 dark:bg-primary-500/[0.12] text-primary-500 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100'
        )}
      >
        <GroupIcon size={20} className="shrink-0" />
        <span className="text-[10px] leading-tight text-center truncate w-full">{group.group}</span>
        <CountBadge n={waiting} dot />
      </NavLink>
    )
  }

  return (
    <div ref={triggerRef}>
      <button
        onClick={() => dropdownOpen ? close() : open()}
        aria-expanded={dropdownOpen}
        className={clsx(
          'relative w-full flex flex-col items-center gap-0.5 px-1 py-2.5 rounded-lg font-medium transition-all duration-150',
          anyActive || dropdownOpen
            ? 'bg-primary-50 dark:bg-primary-500/[0.12] text-primary-500 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100'
        )}
      >
        <GroupIcon size={20} className="shrink-0" />
        <span className="text-[10px] leading-tight text-center truncate w-full">{group.group}</span>
        <CountBadge n={waiting} dot />
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
                    ? 'bg-primary-50 dark:bg-primary-500/[0.12] text-primary-500 dark:text-primary-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ItemIcon size={15} className="shrink-0" />
                <span className="flex-1">{entry.label}</span>
                <CountBadge n={entry.badge ? counts[entry.badge] : 0} />
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
function NavItem({ item, counts }) {
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
        end={item.path === "/"}
        className={({ isActive }) => clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all duration-150',
          isActive
            ? 'bg-primary-50 dark:bg-primary-500/[0.12] text-primary-500 dark:text-primary-400'
            : 'text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100'
        )}
      >
        <Icon size={18} className="shrink-0" />
        <span className="flex-1">{item.label}</span>
        <CountBadge n={item.badge ? counts[item.badge] : 0} />
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
            : 'text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100'
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
                    ? 'bg-primary-50 dark:bg-primary-500/[0.12] text-primary-500 dark:text-primary-400 font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <ChildIcon size={15} className="shrink-0" />
                <span className="flex-1">{child.label}</span>
                <CountBadge n={child.badge ? counts[child.badge] : 0} />
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ mobileOpen, onMobileClose, collapsed = false }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const counts = useSidebarCounts()
  // The icon rail only applies on desktop; the mobile drawer is always full width
  const rail = collapsed && !mobileOpen
  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"
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
          'fixed top-0 start-0 h-full bg-white dark:bg-gray-900 border-e border-gray-200 dark:border-gray-800 z-30 flex flex-col sidebar-transition overflow-hidden',
          rail ? 'w-[5.5rem]' : 'w-64',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full rtl:translate-x-full lg:translate-x-0 rtl:lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center h-16 border-b border-slate-200 dark:border-slate-700 shrink-0',
          rail ? 'justify-center px-3' : 'px-5 gap-3'
        )}>
          <Logo size={32} />
          {!rail && (
            <div>
              <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">PSC-DRFMS</span>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 -mt-0.5 font-medium tracking-wider uppercase">Public Service Commission</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2 space-y-0.5">
          {rail ? (
            /* Collapsed: group icons with flyout */
            <div className="space-y-1">
              {visibleGroups.map(group => (
                <CollapsedGroupItem key={group.group} group={group} counts={counts} />
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
                      <NavItem key={item.path || item.label} item={item} counts={counts} />
                    ))}
                </div>
              </div>
            ))
          )}
          {!rail && <SidebarTags />}
        </nav>

        {/* Bottom user info */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          {rail ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center" title={user?.full_name || user?.email}>
                <span className="text-white font-semibold text-sm">{initials}</span>
              </div>
              <button
                type="button"
                title="Sign out"
                onClick={async () => { await logout(); navigate("/auth/login") }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shrink-0">
                <span className="text-white font-semibold text-sm">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{user?.full_name || user?.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">{user?.role?.replace("_", " ")}</p>
              </div>
              <button
                type="button"
                title="Sign out"
                onClick={async () => { await logout(); navigate("/auth/login") }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
