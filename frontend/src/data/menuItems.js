import {
  LayoutDashboard, FolderOpen, FileText, GitBranch, Mail,
  Search, Shield, Users, BarChart3, Settings,
  Lock, Archive, Trash2, Eye, Share2,
  ClipboardList, AlertTriangle, CheckCircle, Key,
  BookOpen, Activity, Database, Link, Clock,
} from 'lucide-react'

// Role sets — mirrors DriveSidebar and router guards
const NO_RO   = ['reviewer', 'records_officer', 'director', 'commissioner', 'administrator']
const OFFICER = ['records_officer', 'director', 'commissioner', 'administrator']
const DIRPLUS = ['director', 'commissioner', 'administrator']
const ADMIN   = ['administrator']

const menuItems = [
  {
    group: 'Overview',
    groupIcon: LayoutDashboard,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      { label: 'My Tasks', icon: CheckCircle, path: '/workflows/my-tasks' },
    ]
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
        ]
      },
    ]
  },
  {
    group: 'Workflows',
    groupIcon: GitBranch,
    items: [
      { label: 'All Workflows', icon: GitBranch, path: '/workflows' },
      { label: 'My Tasks', icon: CheckCircle, path: '/workflows/my-tasks' },
      { label: 'Templates', icon: ClipboardList, path: '/workflows/templates' },
    ]
  },
  {
    group: 'Compliance',
    groupIcon: Shield,
    items: [
      { label: 'Legal Holds', icon: Lock, path: '/compliance/legal-holds' },
      { label: 'Retention', icon: Clock, path: '/compliance/retention' },
      { label: 'Destruction', icon: Trash2, path: '/compliance/destruction' },
      { label: 'Overdue Records', icon: AlertTriangle, path: '/compliance/overdue' },
    ]
  },
  {
    group: 'Search',
    groupIcon: Search,
    items: [
      { label: 'Search Records', icon: Search, path: '/search' },
    ]
  },
  {
    group: 'Sharing',
    groupIcon: Share2,
    items: [
      { label: 'Shared Links', icon: Link, path: '/sharing' },
    ]
  },
  {
    group: 'Analytics',
    groupIcon: BarChart3,
    roles: DIRPLUS,
    items: [
      { label: 'Dashboard',  icon: Activity, path: '/analytics',       roles: DIRPLUS },
      { label: 'Audit log',  icon: Eye,      path: '/analytics/audit', roles: DIRPLUS },
    ]
  },
  {
    group: 'Administration',
    groupIcon: Settings,
    roles: ADMIN,
    items: [
      { label: 'Users',          icon: Users,     path: '/admin/users',   roles: ADMIN },
      { label: 'System Health',  icon: Activity,  path: '/admin/health',  roles: ADMIN },
    ]
  },
]

export function getAllPaths(items) {
  const paths = []
  items.forEach(item => {
    if (item.path) paths.push(item.path)
    if (item.children) item.children.forEach(c => paths.push(c.path))
  })
  return paths
}

// Prefix-aware active check: /admin/form-types/3/builder matches /admin/form-types
export function isGroupActive(paths, pathname) {
  return paths.some(p => {
    if (p === '/') return pathname === '/'
    return pathname === p || pathname.startsWith(p + '/')
  })
}

// Prefix-aware single-path match (for NavItem child accordion)
export function isPathActive(path, pathname) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}

export function flattenItems(items) {
  const flat = []
  items.forEach(item => {
    if (item.children) {
      flat.push({ type: 'header', label: item.label })
      item.children.forEach(c => flat.push({ type: 'link', ...c }))
    } else {
      flat.push({ type: 'link', ...item })
    }
  })
  return flat
}

export default menuItems
