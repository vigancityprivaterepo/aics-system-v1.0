import { canAccessModule } from './moduleAccess'

export const LIMITED_CASE_TYPES = ['medical', 'hospital', 'plain']

function normalizeDepartment(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function canAccessAllCases(user) {
  if (!canAccessModule(user, 'cases')) return false
  if (user?.role === 'admin') return true
  if (Array.isArray(user?.approvalLevel) && user.approvalLevel.some((level) => ['reviewer', 'recommender', 'approver'].includes(level))) {
    return true
  }
  return normalizeDepartment(user?.department) !== 'cswdo'
}

export function canAccessCases(user) {
  return canAccessModule(user, 'cases')
}

export function allowedCaseTypesForUser(user, allCaseTypes) {
  if (canAccessAllCases(user)) return allCaseTypes
  if (canAccessCases(user) && normalizeDepartment(user?.department) === 'cswdo') {
    return allCaseTypes.filter((type) => LIMITED_CASE_TYPES.includes(type))
  }
  return []
}
