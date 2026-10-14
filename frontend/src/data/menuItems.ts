import {
  LayoutDashboard, FolderOpen, GitBranch, Mail,
  Search, Shield, Users, BarChart3, Settings,
  Lock, Trash2, Eye, ClipboardList, AlertTriangle, CheckCircle,
  Activity, Link, Clock, Star, Inbox, Tag, HardDrive, Cloud, Sparkles, ClipboardCheck,
  SlidersHorizontal, LayoutTemplate, KeyRound, ListChecks,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types/api'

const NO_RO: UserRole[] = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const OFFICER: UserRole[] = ['records_officer', 'director', 'commissioner', 'administrator']
const DIRPLUS: UserRole[] = ['director', 'commissioner', 'administrator']
const ADMIN: UserRole[] = ['administrator']

/** Which live count a menu entry shows as a badge. */
export type BadgeKey = 'inbox' | 'tasks' | 'disposal'

export interface MenuLink {
  label: string
  icon: LucideIcon
  path: string
  roles?: UserRole[]
  badge?: BadgeKey
}

export interface MenuGroupItem {
  label: string
  icon: LucideIcon
  path?: string
  roles?: UserRole[]
  badge?: BadgeKey
  children?: MenuLink[]
}

export interface MenuGroup {
  group: string
  groupIcon: LucideIcon
  roles?: UserRole[]
  items: MenuGroupItem[]
}

export type FlatMenuEntry =
  | { type: 'header'; label: string }
  | ({ type: 'link' } & MenuLink)

const menuItems: MenuGroup[] = [
  {
    group: 'Files',
    groupIcon: FolderOpen,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'All Files', icon: FolderOpen, path: '/browse' },
      { label: 'Recent', icon: Clock, path: '/recent' },
      { label: 'Starred', icon: Star, path: '/starred' },
      { label: 'Shared with me', icon: Users, path: '/shared-with-me' },
      { label: 'Tags', icon: Tag, path: '/tags' },
      { label: 'Search', icon: Search, path: '/search' },
      { label: 'Advanced search', icon: SlidersHorizontal, path: '/search/advanced' },
      { label: 'Ask AI', icon: Sparkles, path: '/ask' },
      { label: 'Recycle bin', icon: Trash2, path: '/bin', roles: OFFICER },
    ],
  },
  {
    group: 'Work',
    groupIcon: ClipboardList,
    items: [
      { label: 'Inbox', icon: Inbox, path: '/inbox', badge: 'inbox' },
      { label: 'My Tasks', icon: CheckCircle, path: '/workflows/my-tasks', roles: NO_RO, badge: 'tasks' },
      { label: 'Correspondence', icon: Mail, path: '/correspondence', roles: OFFICER },
      { label: 'Shared Links', icon: Link, path: '/sharing', roles: OFFICER },
      { label: 'AI review', icon: ClipboardCheck, path: '/ai-review', roles: OFFICER },
      {
        label: 'Workflows', icon: GitBranch, roles: OFFICER,
        children: [
          { label: 'All Workflows', icon: GitBranch, path: '/workflows', roles: OFFICER },
          { label: 'Templates', icon: ClipboardList, path: '/workflows/templates', roles: OFFICER },
        ],
      },
      {
        label: 'Compliance', icon: Shield, roles: OFFICER,
        children: [
          { label: 'Legal Holds', icon: Lock, path: '/compliance/legal-holds' },
          { label: 'Retention', icon: Clock, path: '/compliance/retention' },
          { label: 'Destruction', icon: Trash2, path: '/compliance/destruction' },
          // Records past retention that need a disposal decision (the registry's alternative to a trash can)
          { label: 'Disposal queue', icon: AlertTriangle, path: '/compliance/overdue', badge: 'disposal' },
        ],
      },
    ],
  },
  {
    group: 'Admin',
    groupIcon: Settings,
    roles: DIRPLUS,
    items: [
      { label: 'Insights', icon: BarChart3, path: '/analytics', roles: DIRPLUS },
      { label: 'Audit log', icon: Eye, path: '/analytics/audit', roles: DIRPLUS },
      {
        label: 'Administration', icon: Settings, roles: ADMIN,
        children: [
          { label: 'Users', icon: Users, path: '/admin/users', roles: ADMIN },
          { label: 'Document templates', icon: LayoutTemplate, path: '/admin/templates', roles: ADMIN },
          { label: 'Access rules', icon: KeyRound, path: '/admin/access-rules', roles: ADMIN },
          { label: 'Metadata rules', icon: ListChecks, path: '/admin/metadata', roles: ADMIN },
          { label: 'System Health', icon: Activity, path: '/admin/health', roles: ADMIN },
          { label: 'Backup', icon: HardDrive, path: '/admin/backups', roles: ADMIN },
          { label: 'Microsoft 365', icon: Cloud, path: '/admin/microsoft365', roles: ADMIN },
        ],
      },
    ],
  },
]

/** Items (and accordion children) a role may see; an accordion with nothing visible disappears. */
export function visibleItems(items: MenuGroupItem[], role: UserRole): MenuGroupItem[] {
  return items.flatMap((item) => {
    if (item.roles && !item.roles.includes(role)) return []
    if (!item.children) return [item]
    const children = item.children.filter((c) => !c.roles || c.roles.includes(role))
    return children.length ? [{ ...item, children }] : []
  })
}

export function getAllPaths(items: MenuGroupItem[]): string[] {
  const paths: string[] = []
  items.forEach((item) => {
    if (item.path) paths.push(item.path)
    if (item.children) item.children.forEach((c) => paths.push(c.path))
  })
  return paths
}

export function isGroupActive(paths: string[], pathname: string): boolean {
  return paths.some((p) => {
    if (p === '/') return pathname === '/'
    return pathname === p || pathname.startsWith(p + '/')
  })
}

export function isPathActive(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}

export function flattenItems(items: MenuGroupItem[]): FlatMenuEntry[] {
  const flat: FlatMenuEntry[] = []
  items.forEach((item) => {
    if (item.children) {
      flat.push({ type: 'header', label: item.label })
      item.children.forEach((c) => flat.push({ type: 'link', ...c }))
    } else if (item.path) {
      flat.push({ type: 'link', label: item.label, icon: item.icon, path: item.path, roles: item.roles, badge: item.badge })
    }
  })
  return flat
}

export default menuItems
