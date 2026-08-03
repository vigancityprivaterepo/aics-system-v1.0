import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { canAccessModule, firstAccessiblePath } from '../../utils/moduleAccess'

export default function ProtectedRoute({ roles, redirectTo, moduleKey }) {
  const { user, token, hasHydrated } = useAuthStore()

  if (!hasHydrated) return null

  if (!token || !user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={redirectTo || firstAccessiblePath(user)} replace />
  }

  if (moduleKey && !canAccessModule(user, moduleKey)) {
    return <Navigate to={redirectTo || firstAccessiblePath(user)} replace />
  }

  return <Outlet />
}
