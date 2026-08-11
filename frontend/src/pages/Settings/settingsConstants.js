export const ROLES = [
  { value: 'admin', label: 'Administrator' },
  { value: 'employee', label: 'Employee' },
  { value: 'city_health_office', label: 'City Health Office' },
]

export const APPROVAL_LEVELS = [
  { value: 'preparer', label: 'Case Study Maker' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'recommender', label: 'Recommender' },
  { value: 'approver', label: 'Final Approver' },
]

export const POSITION_OPTIONS = [
  'Administrative Aide I',
  'Administrative Aide II',
  'Administrative Aide III',
  'Administrative Aide IV',
  'Administrative Aide V',
  'Administrative Aide VI',
  'Administrative Assistant I',
  'Administrative Assistant II',
  'Administrative Assistant III',
  'Administrative Assistant IV',
  'Administrative Assistant V',
  'Administrative Assistant VI',
  'Administrative Officer I',
  'Administrative Officer II',
  'Administrative Officer III',
  'Administrative Officer IV',
  'Administrative Officer V',
  'Social Welfare Assistant',
  'Social Welfare Officer I',
  'Social Welfare Officer II',
  'Social Welfare Officer III',
  'Social Welfare Officer IV',
  'Social Welfare Officer V',
  'City Administrator',
  'Executive Secretary',
  'City Health Officer I',
  'City Health Officer II',
  'City Health Officer III',
  'City Health Officer IV',
  'City Health Officer V',
  'City Social Welfare and Development Officer',
  "City Social Welfare and Dev't. Officer",
  'City Mayor',
]

export const DEPARTMENT_OPTIONS = [
  'Administrative',
  'CSWDO',
  'City Health Office',
]

export const CITY_HEALTH_OFFICE_DEPARTMENT = 'City Health Office'

export const MODULE_ACCESS_DEFS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients', label: 'Client Profile' },
  { key: 'cases', label: 'Cases' },
  { key: 'reports', label: 'Reports' },
  { key: 'portal_applications', label: 'Portal Applications' },
  { key: 'documents_verify', label: 'QR Verifier' },
  { key: 'medicines', label: 'Medicines Database' },
  { key: 'vehicle_requests', label: 'Vehicle Requests' },
  { key: 'hospitals', label: 'Hospitals Database' },
  { key: 'funeral_homes', label: 'Funeral Homes Database' },
]

export const DEFAULT_MODULE_ACCESS_CONFIG = {
  dashboard: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  clients: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  cases: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  reports: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  portal_applications: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  documents_verify: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  medicines: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: true },
  vehicle_requests: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: true },
  hospitals: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  funeral_homes: { employeeDepartments: ['Administrative', 'CSWDO'], allowUnassignedEmployees: true, choAllowed: false },
  settings: { employeeDepartments: [], allowUnassignedEmployees: false, choAllowed: false },
}

export function normalizeModuleAccessConfig(value) {
  const source = value && typeof value === 'object' ? value : {}
  return Object.fromEntries(
    Object.entries(DEFAULT_MODULE_ACCESS_CONFIG).map(([key, defaults]) => {
      const current = source[key] && typeof source[key] === 'object' ? source[key] : {}
      const departments = Array.isArray(current.employeeDepartments)
        ? [...new Set(current.employeeDepartments.map((entry) => String(entry || '').trim()).filter(Boolean))]
        : defaults.employeeDepartments
      const legacyChoAllowed =
        typeof current.choAllowed === 'boolean'
          ? current.choAllowed
          : defaults.choAllowed
      const cityHealthAllowed = legacyChoAllowed || departments.some(
        (department) => department.toLowerCase() === CITY_HEALTH_OFFICE_DEPARTMENT.toLowerCase(),
      )
      const normalizedDepartments = cityHealthAllowed && !departments.some(
        (department) => department.toLowerCase() === CITY_HEALTH_OFFICE_DEPARTMENT.toLowerCase(),
      )
        ? [...departments, CITY_HEALTH_OFFICE_DEPARTMENT]
        : departments

      return [key, {
        employeeDepartments: normalizedDepartments,
        allowUnassignedEmployees:
          typeof current.allowUnassignedEmployees === 'boolean'
            ? current.allowUnassignedEmployees
            : defaults.allowUnassignedEmployees,
        choAllowed: cityHealthAllowed,
      }]
    }),
  )
}

export function officeAllowsEmployeeModule(user, moduleKey, config) {
  const rule = config?.[moduleKey] ?? DEFAULT_MODULE_ACCESS_CONFIG[moduleKey]
  if (!user || !rule) return false
  const department = String(user.department ?? '').trim().toLowerCase()
  if (user.role === 'city_health_office') {
    return (rule.employeeDepartments ?? []).some(
      (entry) => String(entry).trim().toLowerCase() === CITY_HEALTH_OFFICE_DEPARTMENT.toLowerCase(),
    )
  }
  if (!department) return !!rule.allowUnassignedEmployees
  if ((rule.employeeDepartments ?? []).length === 0) return true
  return rule.employeeDepartments.some((entry) => String(entry).trim().toLowerCase() === department)
}

export const EMPTY_FORM = {
  name: '',
  username: '',
  role: 'employee',
  approvalLevels: [],
  signatureParam: '',
  position: '',
  department: '',
  password: '',
}

export const AUDIT_PAGE_SIZE = 5

export const CASE_NUMBER_SERIES = [
  { key: 'client', label: 'Client ID', prefixField: 'clientPrefix', sequenceField: 'clientStartSequence', prefixLabel: 'Client Prefix' },
  { key: 'medicine', label: 'Medicine', prefixField: 'medicinePrefix', sequenceField: 'medicineStartSequence', prefixLabel: 'Medicine Prefix' },
  { key: 'burial', label: 'Burial', prefixField: 'burialPrefix', sequenceField: 'burialStartSequence', prefixLabel: 'Burial Prefix' },
  { key: 'hospital', label: 'Hospital', prefixField: 'hospitalPrefix', sequenceField: 'hospitalStartSequence', prefixLabel: 'Hospital Prefix' },
  { key: 'medical', label: 'Medical', prefixField: 'medicalPrefix', sequenceField: 'medicalStartSequence', prefixLabel: 'Medical Prefix' },
  { key: 'eyeglass', label: 'Eyeglass', prefixField: 'eyeglassPrefix', sequenceField: 'eyeglassStartSequence', prefixLabel: 'Eyeglass Prefix' },
  { key: 'plain', label: 'Plain AICS', prefixField: 'plainPrefix', sequenceField: 'plainStartSequence', prefixLabel: 'Plain AICS Prefix' },
]

export const roleLabel = (r) => ROLES.find((x) => x.value === r)?.label ?? r

export const roleBadge = (role) => {
  const map = {
    admin: 'bg-purple-100 text-purple-700',
    employee: 'bg-emerald-100 text-emerald-700',
    city_health_office: 'bg-sky-100 text-sky-700',
  }
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[role] ?? 'bg-slate-100 text-slate-600'}`
}

export const LEVEL_BADGE_COLOR = {
  preparer: 'bg-amber-100 text-amber-700',
  approver: 'bg-emerald-100 text-emerald-700',
  recommender: 'bg-indigo-100 text-indigo-700',
  reviewer: 'bg-violet-100 text-violet-700',
}

export const formatAuditTime = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export const formatFileSize = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
