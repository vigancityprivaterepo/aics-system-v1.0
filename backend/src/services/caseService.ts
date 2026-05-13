import type { AssistanceType, CaseStatus } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { EDIT_LOCKED_STATUSES, STATUS_FLOW } from '../types/caseTypes.js'
import { REQUIREMENT_DEFINITIONS, emptyRequirementMap } from '../utils/requirements.js'

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
  _caseData: { status: CaseStatus; socialWorkerId: string | null },
  user: Express.AuthUser | undefined,
  _scope: string,
) {
  if (!user) throw new HttpError(401, 'Unauthorized')
}

export function assertEditableCase(
  caseData: { status: CaseStatus; socialWorkerId: string | null },
  user: Express.AuthUser | undefined,
  scope: string,
) {
  assertCaseReadable(caseData, user, scope)
  if (EDIT_LOCKED_STATUSES.has(caseData.status)) {
    throw new HttpError(400, `${scope} cannot be modified once case is ${caseData.status.replace('_', ' ')}.`)
  }
}

export function assertReportAccess(
  _caseData: { status: CaseStatus },
  user: Express.AuthUser | undefined,
  _scope: string,
) {
  if (!user) throw new HttpError(401, 'Unauthorized')
}
