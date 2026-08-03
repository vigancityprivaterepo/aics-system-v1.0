import type { PrismaClient } from '@prisma/client'
import { overrideTypeLabel } from './caseOverrideService.js'
import { auditLog } from '../utils/auditLog.js'

type RecordsClient = Pick<
  PrismaClient,
  'case' | 'caseStatusLog' | 'caseOverride' | 'documentVerificationIssue' | 'systemSettings'
>

const CLOSED_CASE_STATUSES = ['released', 'rejected'] as const

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

function actionLabelForLog(log: {
  fromStatus: string
  toStatus: string
  notes: string | null
}) {
  if (log.notes === 'Case intake submitted') return 'Case created'
  if (log.notes?.startsWith('Case archived.')) return 'Case archived'
  if (log.notes?.startsWith('Case returned to encoding after material edit')) return 'Workflow reset after material edit'
  if (log.notes?.startsWith('Requirement ')) return 'Requirement updated'
  if (log.fromStatus !== log.toStatus) return `Status changed to ${statusLabel(log.toStatus)}`
  return 'Case updated'
}

function issuedDocumentKindLabel(kind: string) {
  if (kind === 'guarantee_letter') return 'Guarantee Letter'
  if (kind === 'case_study') return 'Case Study'
  return kind.replace(/_/g, ' ')
}

function retentionCutoffDate(retentionDays: number) {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
}

function daysBetween(older: Date, newer = new Date()) {
  return Math.max(0, Math.floor((newer.getTime() - older.getTime()) / (24 * 60 * 60 * 1000)))
}

export async function getCaseRetentionDays(client: Pick<PrismaClient, 'systemSettings'>) {
  const settings = await client.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  })
  return Number(settings.caseRetentionDays ?? 365)
}

export async function buildCaseHistoryTimeline(client: RecordsClient, caseId: string) {
  const retentionDays = await getCaseRetentionDays(client)
  const [caseRow, logs, overrides, issues] = await Promise.all([
    client.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        isArchived: true,
      },
    }),
    client.caseStatusLog.findMany({
      where: { caseId },
      orderBy: { changedAt: 'desc' },
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            role: true,
          },
        },
      },
    }),
    client.caseOverride.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            role: true,
          },
        },
      },
    }),
    client.documentVerificationIssue.findMany({
      where: { caseId },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        kind: true,
        verificationCode: true,
        issuedAt: true,
        revokedAt: true,
        issuedCaseNumber: true,
        issuedClientName: true,
        issuedBeneficiaryName: true,
      },
    }),
  ])

  const events = [
    ...logs.map((log) => ({
      id: `log:${log.id}`,
      type: log.fromStatus === log.toStatus ? 'edit' : 'status',
      occurredAt: log.changedAt.toISOString(),
      title: actionLabelForLog(log),
      description: log.notes ?? null,
      actor: log.changedBy
        ? {
            id: log.changedBy.id,
            name: log.changedBy.name,
            employeeId: log.changedBy.employeeId,
            role: log.changedBy.role,
          }
        : null,
      meta: {
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
      },
    })),
    ...overrides.map((override) => ({
      id: `override:${override.id}`,
      type: 'override',
      occurredAt: override.createdAt.toISOString(),
      title: overrideTypeLabel(override.type),
      description: override.reason,
      actor: override.createdByUser
        ? {
            id: override.createdByUser.id,
            name: override.createdByUser.name,
            employeeId: override.createdByUser.employeeId,
            role: override.createdByUser.role,
          }
        : null,
      meta: {
        overrideType: override.type,
        context: override.context ?? null,
      },
    })),
    ...issues.map((issue) => ({
      id: `document:${issue.id}`,
      type: 'document_issue',
      occurredAt: issue.issuedAt.toISOString(),
      title: `${issuedDocumentKindLabel(issue.kind)} verification issued`,
      description: issue.revokedAt
        ? `Verification code ${issue.verificationCode} was later revoked on ${issue.revokedAt.toISOString().slice(0, 10)}.`
        : `Verification code ${issue.verificationCode} was issued for ${issue.issuedCaseNumber}.`,
      actor: null,
      meta: {
        kind: issue.kind,
        verificationCode: issue.verificationCode,
        issuedCaseNumber: issue.issuedCaseNumber,
        issuedClientName: issue.issuedClientName,
        issuedBeneficiaryName: issue.issuedBeneficiaryName,
        revokedAt: issue.revokedAt?.toISOString() ?? null,
      },
    })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())

  const isClosedCase = !!caseRow && CLOSED_CASE_STATUSES.includes(caseRow.status as typeof CLOSED_CASE_STATUSES[number])
  const eligibleAt =
    caseRow && isClosedCase && !caseRow.isArchived
      ? new Date(caseRow.updatedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000)
      : null

  return {
    retentionPolicy: {
      caseRetentionDays: retentionDays,
      eligibleAt: eligibleAt?.toISOString() ?? null,
      archiveEligible: !!eligibleAt && eligibleAt <= new Date(),
    },
    events,
  }
}

export async function listArchiveCandidates(
  client: RecordsClient,
  input: {
    retentionDays: number
    limit: number
  },
) {
  const cutoff = retentionCutoffDate(input.retentionDays)
  const cases = await client.case.findMany({
    where: {
      isArchived: false,
      status: {
        in: [...CLOSED_CASE_STATUSES],
      },
      updatedAt: {
        lte: cutoff,
      },
    },
    orderBy: [{ updatedAt: 'asc' }],
    take: input.limit,
    include: {
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      statusLogs: {
        orderBy: { changedAt: 'desc' },
        take: 1,
        select: {
          changedAt: true,
          notes: true,
        },
      },
    },
  })

  return {
    retentionDays: input.retentionDays,
    cutoffDate: cutoff.toISOString(),
    cases: cases.map((caseRow) => {
      const closedAt = caseRow.updatedAt
      const eligibleAt = new Date(closedAt.getTime() + input.retentionDays * 24 * 60 * 60 * 1000)
      return {
        id: caseRow.id,
        caseNumber: caseRow.caseNumber,
        assistanceType: caseRow.assistanceType,
        status: caseRow.status,
        socialWorkerName: caseRow.socialWorkerName ?? null,
        clientName: `${caseRow.client.lastName}, ${caseRow.client.firstName}`,
        closedAt: closedAt.toISOString(),
        eligibleAt: eligibleAt.toISOString(),
        daysClosed: daysBetween(closedAt),
        lastNote: caseRow.statusLogs[0]?.notes ?? null,
      }
    }),
  }
}

export async function archiveCasesByRetentionPolicy(
  client: RecordsClient,
  input: {
    actorId?: string
    retentionDays: number
    caseIds: string[]
  },
) {
  const cutoff = retentionCutoffDate(input.retentionDays)
  const rows = await client.case.findMany({
    where: {
      id: { in: input.caseIds },
    },
    select: {
      id: true,
      caseNumber: true,
      status: true,
      isArchived: true,
      updatedAt: true,
    },
  })

  if (rows.length !== input.caseIds.length) {
    const foundIds = new Set(rows.map((row) => row.id))
    const missingIds = input.caseIds.filter((id) => !foundIds.has(id))
    throw new Error(`Missing cases: ${missingIds.join(', ')}`)
  }

  const invalid = rows.find((row) => row.isArchived || !CLOSED_CASE_STATUSES.includes(row.status as typeof CLOSED_CASE_STATUSES[number]) || row.updatedAt > cutoff)
  if (invalid) {
    throw new Error(`Case ${invalid.caseNumber ?? invalid.id} is not eligible for archival under the current retention policy.`)
  }

  const archived: Array<{ id: string; caseNumber: string | null }> = []
  for (const row of rows) {
    const archiveReason = `Archived under closed-case retention policy after ${input.retentionDays} days in ${statusLabel(row.status)} status.`
    await client.case.update({
      where: { id: row.id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByUserId: input.actorId ?? null,
        archiveReason,
      },
    })
    await auditLog(client, {
      caseId: row.id,
      changedById: input.actorId,
      fromStatus: row.status,
      toStatus: row.status,
      notes: `Case archived. Reason: ${archiveReason}`,
    })
    archived.push({ id: row.id, caseNumber: row.caseNumber ?? null })
  }

  return archived
}
