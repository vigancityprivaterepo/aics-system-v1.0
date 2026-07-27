import type { CaseStatus, PrismaClient } from '@prisma/client'
import { ACTIVE_APPROVAL_STATUSES } from '../types/caseTypes.js'
import { auditLog } from '../utils/auditLog.js'

type WorkflowIntegrityClient = Pick<PrismaClient, 'case' | 'caseApproval' | 'caseStatusLog'>

function uniqueChangedFields(fields: string[]) {
  return [...new Set(fields.map((field) => field.trim()).filter(Boolean))]
}

function formatApprovalSummary(approvals: Array<{ stage: string; action: string; actedByName: string; actedAt: Date }>) {
  if (approvals.length === 0) return 'none'
  return approvals
    .map((approval) => `${approval.stage}:${approval.action} by ${approval.actedByName} on ${approval.actedAt.toISOString().slice(0, 10)}`)
    .join('; ')
}

export function valuesDiffer(currentValue: unknown, nextValue: unknown) {
  return JSON.stringify(currentValue ?? null) !== JSON.stringify(nextValue ?? null)
}

export function activeApprovalStatus(status: CaseStatus) {
  return ACTIVE_APPROVAL_STATUSES.has(status)
}

export async function resetApprovalsAfterMaterialEdit(
  client: WorkflowIntegrityClient,
  input: {
    caseId: string
    changedById?: string
    changedFields: string[]
    reason?: string | null
  },
) {
  const changedFields = uniqueChangedFields(input.changedFields)
  if (changedFields.length === 0) {
    return { status: null as CaseStatus | null, approvalsReset: false }
  }

  const currentCase = await client.case.findUnique({
    where: { id: input.caseId },
    select: { status: true },
  })
  if (!currentCase || !activeApprovalStatus(currentCase.status)) {
    return { status: currentCase?.status ?? null, approvalsReset: false }
  }

  const approvals = await client.caseApproval.findMany({
    where: { caseId: input.caseId },
    orderBy: { actedAt: 'asc' },
    select: { stage: true, action: true, actedByName: true, actedAt: true },
  })

  await client.caseApproval.deleteMany({ where: { caseId: input.caseId } })
  await client.case.update({
    where: { id: input.caseId },
    data: { status: 'encoding' },
  })

  const baseReason = input.reason?.trim()
  const notes = [
    `Case returned to encoding after material edit during ${currentCase.status}.`,
    `Changed fields: ${changedFields.join(', ')}.`,
    `Cleared approvals: ${formatApprovalSummary(approvals)}.`,
    baseReason ? `Reason: ${baseReason}.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  await auditLog(client, {
    caseId: input.caseId,
    changedById: input.changedById,
    fromStatus: currentCase.status,
    toStatus: 'encoding',
    notes,
  })

  return { status: 'encoding' as CaseStatus, approvalsReset: true }
}
