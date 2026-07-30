import type { AssistanceType, CaseStatus } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { ACTIVE_APPROVAL_STATUSES, EDIT_LOCKED_STATUSES, STATUS_FLOW } from '../types/caseTypes.js'
import { REQUIREMENT_DEFINITIONS, emptyRequirementMap } from '../utils/requirements.js'
const NON_ADMIN_ALLOWED_CASE_TYPES: AssistanceType[] = ['hospital', 'medical']
const APPROVAL_CASE_ACCESS_LEVELS = new Set(['reviewer', 'recommender', 'approver'])
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

export function userCanAccessAllCaseTypes(user: Express.AuthUser | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role !== 'employee') return false
  if (FULL_CASE_ACCESS_POSITIONS.has(String(user.position ?? '').trim())) return true
  return user.approvalLevel.some((level) => APPROVAL_CASE_ACCESS_LEVELS.has(level))
}
export function allowedCaseTypesForUser(user: Express.AuthUser | undefined): AssistanceType[] | undefined {
  if (!user) return []
  if (userCanAccessAllCaseTypes(user)) return undefined
  if (user.role === 'employee') return NON_ADMIN_ALLOWED_CASE_TYPES
  return []
}

export function assertAllowedCaseTypeForUser(
  assistanceType: AssistanceType | undefined,
  user: Express.AuthUser | undefined,
  action = 'This case type',
) {
  if (!user) throw new HttpError(401, 'Unauthorized')
  if (userCanAccessAllCaseTypes(user)) return
  if (user.role !== 'employee') {
    throw new HttpError(403, 'Cases are not available for your account.')
  }
  if (assistanceType && NON_ADMIN_ALLOWED_CASE_TYPES.includes(assistanceType)) return
  throw new HttpError(403, `${action} is limited to medical and hospital cases for your account.`)
}
export function paramId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export function normalizeWorkflowStatus(status: CaseStatus): CaseStatus {
  return status === 'requirements' ? 'encoding' : status
}

export function caseStatusToStep(status: CaseStatus): number {
  const idx = STATUS_FLOW.indexOf(normalizeWorkflowStatus(status))
  return idx >= 0 ? idx : -1
}

export function mapRequirements(
  rows: Array<{ requirementName: string; isSubmitted: boolean }>,
  type: AssistanceType,
): Record<string, boolean> {
  const map = emptyRequirementMap(type)
  for (const row of rows) {
    map[row.requirementName] = row.isSubmitted
  }
  return map
}

export async function ensureRequirementRows(caseId: string, type: AssistanceType) {
  const defs = REQUIREMENT_DEFINITIONS[type]
  await prisma.caseRequirement.createMany({
    data: defs.map((d) => ({ caseId, requirementName: d.key, isSubmitted: false })),
    skipDuplicates: true,
  })
}

export function assertCaseReadable(
  caseData: { status: CaseStatus; socialWorkerId: string | null; assistanceType?: AssistanceType; approvals?: Array<{ actedByUserId?: string | null }> },
  user: Express.AuthUser | undefined,
  scope: string,
) {
  if (!user) throw new HttpError(401, 'Unauthorized')
  if (user.role === 'admin') return
  assertAllowedCaseTypeForUser(caseData.assistanceType, user, scope)
  if (caseData.socialWorkerId && caseData.socialWorkerId === user.id) return
  if (Array.isArray(caseData.approvals) && caseData.approvals.some((approval) => approval.actedByUserId === user.id)) return

  const normalizedStatus = normalizeWorkflowStatus(caseData.status)
  const approvalLevels = Array.isArray(user.approvalLevel) ? user.approvalLevel : []
  if (normalizedStatus === 'for_review' && approvalLevels.includes('reviewer')) return
  if (normalizedStatus === 'recommending_approval' && approvalLevels.includes('recommender')) return
  if (normalizedStatus === 'for_approval' && approvalLevels.includes('approver')) return
  if (
    ['approved', 'released', 'rejected'].includes(normalizedStatus) &&
    approvalLevels.some((level) => ['reviewer', 'recommender', 'approver'].includes(level))
  ) {
    return
  }

  throw new HttpError(403, `${scope} is not available for your account.`)
}

export function assertEditableCase(
  caseData: { status: CaseStatus; socialWorkerId: string | null; assistanceType?: AssistanceType; approvals?: Array<{ actedByUserId?: string | null }> },
  user: Express.AuthUser | undefined,
  scope: string,
) {
  assertCaseReadable(caseData, user, scope)
  if (user?.role !== 'admin' && caseData.socialWorkerId !== user?.id) {
    throw new HttpError(403, `${scope} can only be modified by the assigned case maker or an admin.`)
  }
  if (EDIT_LOCKED_STATUSES.has(caseData.status)) {
    throw new HttpError(400, `${scope} cannot be modified once case is ${caseData.status.replace('_', ' ')}.`)
  }
}

export function assertReportAccess(
  caseData: { status: CaseStatus; socialWorkerId: string | null; assistanceType?: AssistanceType; approvals?: Array<{ actedByUserId?: string | null }> },
  user: Express.AuthUser | undefined,
  scope: string,
) {
  assertCaseReadable(caseData, user, scope)
}
