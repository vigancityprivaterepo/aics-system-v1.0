import type { Prisma, PrismaClient } from '@prisma/client'

type AdminAuditClient = Pick<PrismaClient, 'adminAuditLog'>

interface AdminAuditInput {
  actorId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  summary: string
  details?: Prisma.InputJsonValue
}

export async function logAdminAudit(client: AdminAuditClient, input: AdminAuditInput) {
  return client.adminAuditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      summary: input.summary,
      ...(input.details !== undefined ? { details: input.details } : {}),
    },
  })
}
