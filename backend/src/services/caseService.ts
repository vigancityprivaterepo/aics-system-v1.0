import type { AssistanceType, CaseStatus } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { ACTIVE_APPROVAL_STATUSES, EDIT_LOCKED_STATUSES, STATUS_FLOW } from '../types/caseTypes.js'
import { emptyRequirementMap, requirementDefinitionsForType } from '../utils/requirements.js'

const CSWDO_ALLOWED_CASE_TYPES: AssistanceType[] = ['medical', 'hospital', 'plain']
const APPROVAL_EDITOR_LEVELS = ['reviewer', 'recommender', 'approver'] as const

function normalizeDepartment(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function userCanBypassOwnership(user: Express.AuthUser | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return APPROVAL_EDITOR_LEVELS.some((level) => user.approvalLevel.includes(level))
}

function ownerEditLockedByWorkflow(
  caseData: { status: CaseStatus; socialWorkerId: string | null },
  user: Express.AuthUser | undefined,
) {
  return caseData.socialWorkerId === user?.id && ACTIVE_APPROVAL_STATUSES.has(caseData.status)
}

export function userCanAccessAllCaseTypes(user: Express.AuthUser | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (!user.accessibleModules.includes('cases')) return false
  if (APPROVAL_EDITOR_LEVELS.some((level) => user.approvalLevel.includes(level))) return true
  return normalizeDepartment(user.department) !== 'cswdo'
}
export function allowedCaseTypesForUser(user: Express.AuthUser | undefined): AssistanceType[] | undefined {
  if (userCanAccessAllCaseTypes(user)) return undefined
  if (user?.accessibleModules.includes('cases') && normalizeDepartment(user.department) === 'cswdo') {
    return CSWDO_ALLOWED_CASE_TYPES
  }
  return []
}

export function assertAllowedCaseTypeForUser(
  assistanceType: AssistanceType | undefined,
  user: Express.AuthUser | undefined,
  action = 'This case type',
) {
  if (!user) throw new HttpError(401, 'Unauthorized')
  if (userCanAccessAllCaseTypes(user)) return
  const allowedTypes = allowedCaseTypesForUser(user)
  if (assistanceType && allowedTypes?.includes(assistanceType)) return
  throw new HttpError(403, `${action} is not available for your account.`)
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
  plainAssistanceKinds: AssistanceType[] = [],
): Record<string, boolean> {
  const map = emptyRequirementMap(type, plainAssistanceKinds)
  for (const row of rows) {
    map[row.requirementName] = row.isSubmitted
  }
  return map
}

export async function ensureRequirementRows(caseId: string, type: AssistanceType, plainAssistanceKinds: AssistanceType[] = []) {
  const defs = requirementDefinitionsForType(type, plainAssistanceKinds)
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
  assertAllowedCaseTypeForUser(caseData.assistanceType, user, scope)
  if (user.role === 'admin') return
  if (user.accessibleModules.includes('cases')) return
  throw new HttpError(403, `${scope} is not available for your account.`)
}

export function assertEditableCase(
  caseData: { status: CaseStatus; socialWorkerId: string | null; assistanceType?: AssistanceType; approvals?: Array<{ actedByUserId?: string | null }> },
  user: Express.AuthUser | undefined,
  scope: string,
) {
  assertCaseReadable(caseData, user, scope)
  const canBypassOwnership = userCanBypassOwnership(user)
  if (!canBypassOwnership && caseData.socialWorkerId !== user?.id) {
    throw new HttpError(403, `${scope} can only be modified by assigned case maker, reviewer, recommender, approver, or admin.`)
  }
  if (!canBypassOwnership && ownerEditLockedByWorkflow(caseData, user)) {
    throw new HttpError(403, 'Case maker editing is locked after submission for review. Wait until the case is returned to encoding.')
  }
  if (EDIT_LOCKED_STATUSES.has(caseData.status)) {
    throw new HttpError(400, `${scope} cannot be modified once case is ${caseData.status.replace('_', ' ')}.`)
  }
}

export function casePermissions(
  caseData: { status: CaseStatus; socialWorkerId: string | null },
  user: Express.AuthUser | undefined,
) {
  const isOwner = Boolean(user && caseData.socialWorkerId && caseData.socialWorkerId === user.id)
  const canBypassOwnership = userCanBypassOwnership(user)
  const workflowLocked = EDIT_LOCKED_STATUSES.has(caseData.status)
  const ownerWorkflowLocked = ownerEditLockedByWorkflow(caseData, user)
  const canModify = Boolean(user) && !workflowLocked && (
    canBypassOwnership || (isOwner && !ownerWorkflowLocked)
  )
  const canDelete = Boolean(user) && ((user?.role === 'admin') || isOwner)

  return {
    isOwner,
    canEdit: canModify,
    canManageWorkflow: canModify,
    canDelete,
    readOnly: !canModify,
    workflowLocked,
  }
}

export function assertReportAccess(
  caseData: { status: CaseStatus; socialWorkerId: string | null; assistanceType?: AssistanceType; approvals?: Array<{ actedByUserId?: string | null }> },
  user: Express.AuthUser | undefined,
  scope: string,
) {
  assertCaseReadable(caseData, user, scope)
}
