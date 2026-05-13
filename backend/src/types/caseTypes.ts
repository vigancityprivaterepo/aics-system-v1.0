import type { ApprovalStage, CaseStatus } from '@prisma/client'

export const APPROVAL_LEVEL_VALUES = ['reviewer', 'recommender', 'approver', 'preparer'] as const
export type ApprovalLevelValue = typeof APPROVAL_LEVEL_VALUES[number]

export type ApprovalAssignee = {
  id: string
  name: string
  approvalLevel: string
  eSignatureUrl: string | null
  signatureParam: string | null
  isActive: boolean
}

export type ApprovalAssigneeByStage = Record<ApprovalStage, ApprovalAssignee | null>

export const STATUS_FLOW: CaseStatus[] = [
  'intake', 'encoding', 'for_review', 'recommending_approval', 'for_approval', 'approved', 'released',
]

export const EDIT_LOCKED_STATUSES = new Set<CaseStatus>(['approved', 'released', 'rejected'])

export const ACTIVE_APPROVAL_STATUSES = new Set<CaseStatus>([
  'for_review', 'recommending_approval', 'for_approval',
])

export const APPROVAL_STAGE_ORDER: ApprovalStage[] = [
  'for_review', 'recommending_approval', 'for_approval',
]

export const APPROVAL_STAGE_META: Record<ApprovalStage, {
  settingsField: 'reviewedByUserId' | 'recommendingUserId' | 'approvedByUserId'
  title: string
  nextStatus: CaseStatus
  label: string
}> = {
  for_review: {
    settingsField: 'reviewedByUserId',
    title: 'Social Welfare Officer II',
    nextStatus: 'recommending_approval',
    label: 'Reviewed by',
  },
  recommending_approval: {
    settingsField: 'recommendingUserId',
    title: "City Social Welfare and Dev't. Officer",
    nextStatus: 'for_approval',
    label: 'Recommending Approval',
  },
  for_approval: {
    settingsField: 'approvedByUserId',
    title: 'City Mayor',
    nextStatus: 'approved',
    label: 'Approved',
  },
}
