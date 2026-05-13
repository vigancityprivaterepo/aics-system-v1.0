import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

function defaultRedirectForRole(role) {
  return role === 'city_health_office' ? '/medicines' : '/dashboard'
}

export default function ProtectedRoute({ roles, redirectTo }) {
  const { user, token, hasHydrated } = useAuthStore()

  if (!hasHydrated) return null

  if (!token || !user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={redirectTo || defaultRedirectForRole(user.role)} replace />
  }

  return <Outlet />
}
