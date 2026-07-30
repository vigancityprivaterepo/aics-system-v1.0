const FULL_CASE_ACCESS_POSITIONS = new Set([
  'Administrative Aide I',
  'Administrative Aide II',
  'Administrative Aide III',
  'Administrative Aide IV',
  'Administrative Aide V',
  'Administrative Assistant I',
  'Administrative Assistant II',
  'Administrative Assistant III',
  'Administrative Assistant IV',
  'Administrative Assistant V',
  'Administrative Officer I',
  'Administrative Officer II',
  'Administrative Officer III',
  'Administrative Officer IV',
])

export const LIMITED_CASE_TYPES = ['medical', 'hospital']

export function canAccessAllCases(user) {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.role === 'employee' && FULL_CASE_ACCESS_POSITIONS.has(String(user.position ?? '').trim())
}

export function canAccessCases(user) {
  return canAccessAllCases(user) || user?.role === 'employee'
}

export function allowedCaseTypesForUser(user, allCaseTypes) {
  if (canAccessAllCases(user)) return allCaseTypes
  if (user?.role === 'employee') return LIMITED_CASE_TYPES
  return []
}