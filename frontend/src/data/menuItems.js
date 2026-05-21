import {
  LayoutDashboard, FolderOpen, FileText, GitBranch, Mail,
  Search, Shield, Users, BarChart3, Settings, Bell,
  Lock, Archive, Trash2, Eye, Share2, ChevronRight,
  ClipboardList, AlertTriangle, CheckCircle, Key,
  BookOpen, FileCheck, Activity, Database, Link,
  MessageSquare, Star, Clock, LogIn
} from 'lucide-react'

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
    items: [
      { label: 'Dashboard', icon: Activity, path: '/analytics' },
      { label: 'Audit Trail', icon: Eye, path: '/analytics/audit' },
      { label: 'Compliance Report', icon: FileCheck, path: '/analytics/compliance' },
    ]
  },
  {
    group: 'Administration',
    groupIcon: Settings,
    items: [
      { label: 'Users', icon: Users, path: '/admin/users' },
      { label: 'Departments', icon: Database, path: '/admin/departments' },
      { label: 'API Keys', icon: Key, path: '/admin/api-keys' },
      { label: 'System Health', icon: Activity, path: '/admin/health' },
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
