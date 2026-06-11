import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

import type { UserRole } from '@/types/api'

interface RequireRoleProps {
  roles: UserRole[]
}

export default function RequireRole({ roles }: RequireRoleProps) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
