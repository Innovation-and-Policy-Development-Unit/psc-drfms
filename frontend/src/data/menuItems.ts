import {
  LayoutDashboard, FolderOpen, GitBranch, Mail,
  Search, Shield, Users, BarChart3, Settings,
  Lock, Trash2, Eye, ClipboardList, AlertTriangle, CheckCircle,
  Activity, Link, Clock, Star, Inbox, Upload,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types/api'

const NO_RO: UserRole[] = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const OFFICER: UserRole[] = ['records_officer', 'director', 'commissioner', 'administrator']
const DIRPLUS: UserRole[] = ['director', 'commissioner', 'administrator']
const ADMIN: UserRole[] = ['administrator']

export interface MenuLink {
  label: string
  icon: LucideIcon
  path: string
  roles?: UserRole[]
}

export interface MenuGroupItem {
  label: string
  icon: LucideIcon
  path?: string
  roles?: UserRole[]
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
    group: 'Workspace',
    groupIcon: LayoutDashboard,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'All Files', icon: FolderOpen, path: '/browse' },
      { label: 'Recent', icon: Clock, path: '/recent' },
      { label: 'Starred', icon: Star, path: '/starred' },
      { label: 'Shared with me', icon: Users, path: '/shared-with-me' },
      { label: 'Search', icon: Search, path: '/search' },
      { label: 'Inbox', icon: Inbox, path: '/inbox' },
    ],
  },
  {
    group: 'Records',
    groupIcon: FolderOpen,
    roles: OFFICER,
    items: [
      { label: 'Upload Record', icon: Upload, path: '/upload', roles: OFFICER },
      { label: 'Correspondence', icon: Mail, path: '/correspondence', roles: OFFICER },
      { label: 'Shared Links', icon: Link, path: '/sharing', roles: OFFICER },
    ],
  },
  {
    group: 'Workflows',
    groupIcon: GitBranch,
    roles: NO_RO,
    items: [
      { label: 'My Tasks', icon: CheckCircle, path: '/workflows/my-tasks', roles: NO_RO },
      { label: 'All Workflows', icon: GitBranch, path: '/workflows', roles: OFFICER },
      { label: 'Templates', icon: ClipboardList, path: '/workflows/templates', roles: OFFICER },
    ],
  },
  {
    group: 'Compliance',
    groupIcon: Shield,
    roles: OFFICER,
    items: [
      { label: 'Legal Holds', icon: Lock, path: '/compliance/legal-holds' },
      { label: 'Retention', icon: Clock, path: '/compliance/retention' },
      { label: 'Destruction', icon: Trash2, path: '/compliance/destruction' },
      { label: 'Overdue Records', icon: AlertTriangle, path: '/compliance/overdue' },
    ],
  },
  {
    group: 'Analytics',
    groupIcon: BarChart3,
    roles: DIRPLUS,
    items: [
      { label: 'Insights', icon: Activity, path: '/analytics', roles: DIRPLUS },
      { label: 'Audit log', icon: Eye, path: '/analytics/audit', roles: DIRPLUS },
    ],
  },
  {
    group: 'Administration',
    groupIcon: Settings,
    roles: ADMIN,
    items: [
      { label: 'Users', icon: Users, path: '/admin/users', roles: ADMIN },
      { label: 'System Health', icon: Activity, path: '/admin/health', roles: ADMIN },
    ],
  },
]

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
      flat.push({ type: 'link', label: item.label, icon: item.icon, path: item.path, roles: item.roles })
    }
  })
  return flat
}

export default menuItems
