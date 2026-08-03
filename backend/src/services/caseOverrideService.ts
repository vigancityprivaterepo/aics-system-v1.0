import type { Prisma, PrismaClient } from '@prisma/client'

type OverrideClient = Pick<PrismaClient, 'caseOverride'>

type OverrideInput = {
  caseId: string
  createdByUserId?: string | null
  type: 'workflow_submission' | 'amount_mismatch' | 'repeat_assistance'
  reason: string
  context?: Prisma.InputJsonValue
}

export async function recordCaseOverride(client: OverrideClient | Prisma.TransactionClient, input: OverrideInput) {
  return client.caseOverride.create({
    data: {
      caseId: input.caseId,
      createdByUserId: input.createdByUserId ?? null,
      type: input.type,
      reason: input.reason.trim(),
      context: input.context,
    },
  })
}

export function overrideTypeLabel(type: string) {
  if (type === 'workflow_submission') return 'Workflow override'
  if (type === 'amount_mismatch') return 'Amount override'
  if (type === 'repeat_assistance') return 'Repeat assistance override'
  return 'Override'
}

export function buildComplianceNotice(override: {
  type: string
  reason: string
  createdAt?: Date | string | null
  createdByUser?: { name?: string | null } | null
} | null | undefined) {
  if (!override?.reason) return null

  const actor = override.createdByUser?.name?.trim() || 'Unknown user'
  const createdAt =
    override.createdAt instanceof Date
      ? override.createdAt
      : override.createdAt
        ? new Date(override.createdAt)
        : null
  const dateLabel =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Unknown date'

  return `${overrideTypeLabel(override.type)} recorded on ${dateLabel} by ${actor}. Reason: ${override.reason}`
}
