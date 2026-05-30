import {
  LayoutDashboard, FolderOpen, FileText, GitBranch, Mail,
  Search, Shield, Users, BarChart3, Settings,
  Lock, Archive, Trash2, Eye, Share2,
  ClipboardList, AlertTriangle, CheckCircle,
  BookOpen, Activity, Link, Clock,
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
    group: 'Overview',
    groupIcon: LayoutDashboard,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'My Tasks', icon: CheckCircle, path: '/workflows/my-tasks' },
    ],
  },
  {
    group: 'Records',
    groupIcon: FolderOpen,
    items: [
      { label: 'All Records', icon: FolderOpen, path: '/records' },
      { label: 'Upload Record', icon: FileText, path: '/records/upload' },
      {
        label: 'Classification',
        icon: BookOpen,
        children: [
          { label: 'Record Series', icon: Archive, path: '/records/series' },
          { label: 'Correspondence', icon: Mail, path: '/correspondence' },
        ],
      },
    ],
  },
  {
    group: 'Workflows',
    groupIcon: GitBranch,
    items: [
      { label: 'All Workflows', icon: GitBranch, path: '/workflows' },
      { label: 'My Tasks', icon: CheckCircle, path: '/workflows/my-tasks' },
      { label: 'Templates', icon: ClipboardList, path: '/workflows/templates' },
    ],
  },
  {
    group: 'Compliance',
    groupIcon: Shield,
    items: [
      { label: 'Legal Holds', icon: Lock, path: '/compliance/legal-holds' },
      { label: 'Retention', icon: Clock, path: '/compliance/retention' },
      { label: 'Destruction', icon: Trash2, path: '/compliance/destruction' },
      { label: 'Overdue Records', icon: AlertTriangle, path: '/compliance/overdue' },
    ],
  },
  {
    group: 'Search',
    groupIcon: Search,
    items: [
      { label: 'Search Records', icon: Search, path: '/search' },
    ],
  },
  {
    group: 'Sharing',
    groupIcon: Share2,
    items: [
      { label: 'Shared Links', icon: Link, path: '/sharing' },
    ],
  },
  {
    group: 'Analytics',
    groupIcon: BarChart3,
    roles: DIRPLUS,
    items: [
      { label: 'Dashboard', icon: Activity, path: '/analytics', roles: DIRPLUS },
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
