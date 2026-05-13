import type { CaseStatus, PrismaClient } from '@prisma/client'

type AuditClient = Pick<PrismaClient, 'caseStatusLog'>

interface AuditLogInput {
  caseId: string
  changedById?: string
  fromStatus: CaseStatus
  toStatus: CaseStatus
  notes?: string | null
}

export async function auditLog(client: AuditClient, data: AuditLogInput) {
  return client.caseStatusLog.create({ data })
}

export async function auditLogMany(client: AuditClient, data: AuditLogInput[]) {
  if (data.length === 0) return
  return client.caseStatusLog.createMany({ data })
}
