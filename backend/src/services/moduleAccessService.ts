import { prisma } from '../utils/prisma.js'

export const STAFF_MODULE_KEYS = [
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
] as const

export type StaffModuleKey = typeof STAFF_MODULE_KEYS[number]

export type ModuleAccessRule = {
  employeeDepartments: string[]
  allowUnassignedEmployees: boolean
  choAllowed: boolean
}

export type ModuleAccessConfig = Record<StaffModuleKey, ModuleAccessRule>
export type ModuleAccessOverrides = Partial<Record<StaffModuleKey, boolean>>

export const COMMON_DEPARTMENT_OPTIONS = [
  'Administrative',
  'CSWDO',
  'City Health Office',
] as const

const EMPLOYEE_DEFAULT_DEPARTMENTS = ['Administrative', 'CSWDO']
const CITY_HEALTH_OFFICE_DEPARTMENT = 'City Health Office'

const DEFAULT_RULE: ModuleAccessRule = {
  employeeDepartments: [...EMPLOYEE_DEFAULT_DEPARTMENTS],
  allowUnassignedEmployees: true,
  choAllowed: false,
}

const DEFAULT_MODULE_ACCESS_CONFIG: ModuleAccessConfig = {
  dashboard: { ...DEFAULT_RULE },
  clients: { ...DEFAULT_RULE },
  cases: { ...DEFAULT_RULE },
  reports: { ...DEFAULT_RULE },
  portal_applications: { ...DEFAULT_RULE },
  documents_verify: { ...DEFAULT_RULE },
  medicines: { ...DEFAULT_RULE, choAllowed: true },
  vehicle_requests: { ...DEFAULT_RULE, choAllowed: true },
  hospitals: { ...DEFAULT_RULE },
  funeral_homes: { ...DEFAULT_RULE },
  settings: {
    employeeDepartments: [],
    allowUnassignedEmployees: false,
    choAllowed: false,
  },
}

function normalizeDepartment(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function normalizeDepartmentList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const departments: string[] = []

  for (const item of value) {
    const raw = String(item ?? '').trim()
    const normalized = normalizeDepartment(raw)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    departments.push(raw)
  }

  return departments
}

export function buildModuleAccessConfig(raw: unknown): ModuleAccessConfig {
  let parsed: unknown = raw

  if (typeof raw === 'string') {
    try {
      parsed = raw.trim() ? JSON.parse(raw) : {}
    } catch {
      parsed = {}
    }
  }

  const input = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  const config = {} as ModuleAccessConfig

  for (const key of STAFF_MODULE_KEYS) {
    const fallback = DEFAULT_MODULE_ACCESS_CONFIG[key]
    const value = input[key]
    const entry = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const employeeDepartments = normalizeDepartmentList(entry.employeeDepartments ?? fallback.employeeDepartments)
    const legacyChoAllowed =
      typeof entry.choAllowed === 'boolean'
        ? entry.choAllowed
        : fallback.choAllowed
    const cityHealthAllowed = legacyChoAllowed || employeeDepartments.some(
      (department) => normalizeDepartment(department) === normalizeDepartment(CITY_HEALTH_OFFICE_DEPARTMENT),
    )

    if (cityHealthAllowed && !employeeDepartments.some(
      (department) => normalizeDepartment(department) === normalizeDepartment(CITY_HEALTH_OFFICE_DEPARTMENT),
    )) {
      employeeDepartments.push(CITY_HEALTH_OFFICE_DEPARTMENT)
    }

    config[key] = {
      employeeDepartments,
      allowUnassignedEmployees:
        typeof entry.allowUnassignedEmployees === 'boolean'
          ? entry.allowUnassignedEmployees
          : fallback.allowUnassignedEmployees,
      choAllowed: cityHealthAllowed,
    }
  }

  return config
}

export function serializeModuleAccessConfig(config: unknown): string {
  return JSON.stringify(buildModuleAccessConfig(config))
}

export function buildModuleAccessOverrides(raw: unknown): ModuleAccessOverrides {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = raw.trim() ? JSON.parse(raw) : {}
    } catch {
      parsed = {}
    }
  }

  const input = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  const overrides: ModuleAccessOverrides = {}
  for (const key of STAFF_MODULE_KEYS) {
    if (key !== 'settings' && typeof input[key] === 'boolean') {
      overrides[key] = input[key]
    }
  }
  return overrides
}

export function serializeModuleAccessOverrides(overrides: unknown): string {
  return JSON.stringify(buildModuleAccessOverrides(overrides))
}

export async function getModuleAccessConfig() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'singleton' },
    select: { moduleAccessConfig: true },
  })

  return buildModuleAccessConfig(settings?.moduleAccessConfig)
}

type AccessUser = {
  role: string
  department?: string | null
  moduleAccessOverrides?: unknown
}

export function userHasModuleAccess(
  user: AccessUser | null | undefined,
  moduleKey: StaffModuleKey,
  config: ModuleAccessConfig,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (moduleKey === 'settings') return false

  const employeeOverride = buildModuleAccessOverrides(user.moduleAccessOverrides)[moduleKey]
  if (typeof employeeOverride === 'boolean') return employeeOverride

  const rule = config[moduleKey]
  if (!rule) return false

  if (user.role === 'city_health_office') {
    return rule.employeeDepartments.some(
      (entry) => normalizeDepartment(entry) === normalizeDepartment(CITY_HEALTH_OFFICE_DEPARTMENT),
    )
  }

  if (user.role !== 'employee') return false

  const department = normalizeDepartment(user.department)
  if (!department) return rule.allowUnassignedEmployees
  if (rule.employeeDepartments.length === 0) return true

  return rule.employeeDepartments.some((entry) => normalizeDepartment(entry) === department)
}

export function getAccessibleModulesForUser(
  user: AccessUser | null | undefined,
  config: ModuleAccessConfig,
): StaffModuleKey[] {
  if (!user) return []
  if (user.role === 'admin') return [...STAFF_MODULE_KEYS]
  return STAFF_MODULE_KEYS.filter((key) => userHasModuleAccess(user, key, config))
}
