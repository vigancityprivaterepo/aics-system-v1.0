export const MODULE_KEYS = [
  'dashboard',
  'clients',
  'cases',
  'reports',
  'portal_applications',
  'documents_verify',
  'medicines',
  'vehicle_requests',
  'hospitals',
  'funeral_homes',
  'settings',
]

const MODULE_DEFAULT_PATH = {
  dashboard: '/dashboard',
  clients: '/clients',
  cases: '/cases',
  reports: '/reports',
  portal_applications: '/portal-applications',
  documents_verify: '/documents/verify',
  medicines: '/medicines',
  vehicle_requests: '/vehicle-requests',
  hospitals: '/hospitals',
  funeral_homes: '/funeral-homes',
  settings: '/settings',
}

export function canAccessModule(user, moduleKey) {
  if (!user || !moduleKey) return false
  if (user.role === 'admin') return true
  return Array.isArray(user.accessibleModules) && user.accessibleModules.includes(moduleKey)
}

export function firstAccessiblePath(user) {
  for (const moduleKey of MODULE_KEYS) {
    if (canAccessModule(user, moduleKey)) {
      return MODULE_DEFAULT_PATH[moduleKey] ?? '/dashboard'
    }
  }
  return '/login'
}
