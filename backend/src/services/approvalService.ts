import type { ApprovalStage, CaseStatus } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import {
  APPROVAL_LEVEL_VALUES,
  APPROVAL_STAGE_META,
  APPROVAL_STAGE_ORDER,
  ACTIVE_APPROVAL_STATUSES,
  type ApprovalAssignee,
  type ApprovalAssigneeByStage,
  type ApprovalLevelValue,
} from '../types/caseTypes.js'
import type { ApprovalSettings } from '../queries/caseQueries.js'

export function parseApprovalLevels(stored: string | null | undefined): ApprovalLevelValue[] {
  if (!stored || stored === 'none') return []
  return stored
    .split(',')
    .map((part) => part.trim())
    .filter((level): level is ApprovalLevelValue => APPROVAL_LEVEL_VALUES.includes(level as ApprovalLevelValue))
}

export function approvalActorTitle(stage: ApprovalStage): string {
  return APPROVAL_STAGE_META[stage].title
}

export function requiredApprovalLevel(stage: ApprovalStage): 'reviewer' | 'recommender' | 'approver' {
  if (stage === 'for_review') return 'reviewer'
  if (stage === 'recommending_approval') return 'recommender'
  return 'approver'
}

export function isApprovalProgressTransition(currentStatus: CaseStatus, nextStatus: CaseStatus): boolean {
  const stage = statusToApprovalStage(currentStatus)
  if (!stage) return false
  return APPROVAL_STAGE_META[stage].nextStatus === nextStatus
}

export function statusToApprovalStage(status: CaseStatus): ApprovalStage | null {
  if (status === 'for_review') return 'for_review'
  if (status === 'recommending_approval') return 'recommending_approval'
  if (status === 'for_approval') return 'for_approval'
  return null
}

export function mapApprovalAssignee(
  user: ApprovalSettings['reviewedByUser'] | ApprovalSettings['recommendingUser'] | ApprovalSettings['approvedByUser'] | null | undefined
): ApprovalAssignee | null {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    approvalLevel: user.approvalLevel,
    eSignatureUrl: user.eSignatureUrl ?? null,
    signatureParam: user.signatureParam ?? null,
    position: user.position ?? null,
    isActive: user.isActive,
  }
}

export function approvalAssigneesByStage(settings: ApprovalSettings): ApprovalAssigneeByStage {
  return {
    for_review: mapApprovalAssignee(settings.reviewedByUser),
    recommending_approval: mapApprovalAssignee(settings.recommendingUser),
    for_approval: mapApprovalAssignee(settings.approvedByUser),
  }
}

export async function resolveApprovalAssignees(settings: ApprovalSettings): Promise<ApprovalAssigneeByStage> {
  return approvalAssigneesByStage(settings)
}

export function assertTransitionPermission(
  currentStatus: CaseStatus,
  nextStatus: CaseStatus,
  user: Express.AuthUser | undefined,
  notes: string | undefined,
) {
  if (!user) throw new HttpError(401, 'Unauthorized')

  if (nextStatus === 'rejected') {
    if (!notes?.trim()) throw new HttpError(400, 'Rejection notes are required.')
    if (!ACTIVE_APPROVAL_STATUSES.has(currentStatus)) {
      throw new HttpError(400, 'Cases can only be rejected from pending approval stages.')
    }
  }
}

export function normalizeApprovalNotes(notes: string | undefined): string | null {
  const value = String(notes ?? '').trim()
  return value.length > 0 ? value : null
}


