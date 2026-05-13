import type { Request, Response } from 'express'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { REQUIREMENT_DEFINITIONS } from '../utils/requirements.js'
import { assertCaseReadable, assertEditableCase, ensureRequirementRows, mapRequirements, paramId } from '../services/caseService.js'
import { updateRequirementsSchema, patchRequirementSchema } from '../schemas/caseSchemas.js'
import { auditLog, auditLogMany } from '../utils/auditLog.js'

export async function getRequirements(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { requirements: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Requirements')
  await ensureRequirementRows(caseData.id, caseData.assistanceType)

  const rows = await prisma.caseRequirement.findMany({ where: { caseId: caseData.id }, orderBy: { createdAt: 'asc' } })
  res.json({
    requirements: rows.map((r) => ({ id: r.id, key: r.requirementName, isSubmitted: r.isSubmitted, notes: r.notes, submittedAt: r.submittedAt })),
    map: mapRequirements(rows, caseData.assistanceType),
  })
}

export async function updateRequirements(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const { requirements } = updateRequirementsSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Requirements')
  await ensureRequirementRows(caseData.id, caseData.assistanceType)

  const defs = REQUIREMENT_DEFINITIONS[caseData.assistanceType]
  const allowedKeys = new Set(defs.map((d) => d.key))
  const existingRows = await prisma.caseRequirement.findMany({ where: { caseId: caseData.id } })
  const existingMap = new Map(existingRows.map((r) => [r.requirementName, r.isSubmitted]))
  const changedEntries = Object.entries(requirements)
    .filter(([key]) => allowedKeys.has(key))
    .filter(([key, isSubmitted]) => existingMap.get(key) !== isSubmitted)

  await prisma.$transaction(
    Object.entries(requirements)
      .filter(([key]) => allowedKeys.has(key))
      .map(([key, isSubmitted]) =>
        prisma.caseRequirement.upsert({
          where: { caseId_requirementName: { caseId: caseData.id, requirementName: key } },
          update: { isSubmitted, submittedAt: isSubmitted ? new Date() : null },
          create: { caseId: caseData.id, requirementName: key, isSubmitted, submittedAt: isSubmitted ? new Date() : null },
        }),
      ),
  )

  if (changedEntries.length > 0) {
    await auditLogMany(prisma, changedEntries.map(([key, isSubmitted]) => ({
      caseId: caseData.id,
      changedById: req.user?.id,
      fromStatus: caseData.status,
      toStatus: caseData.status,
      notes: `Requirement ${key} marked as ${isSubmitted ? 'submitted' : 'not submitted'}`,
    })))
  }

  const rows = await prisma.caseRequirement.findMany({ where: { caseId: caseData.id } })
  res.json({ requirements: mapRequirements(rows, caseData.assistanceType) })
}

export async function patchRequirement(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const reqId = paramId(req.params.reqId)
  const payload = patchRequirementSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Requirements')

  const reqRow = await prisma.caseRequirement.findFirst({ where: { id: reqId, caseId } })
  if (!reqRow) throw new HttpError(404, 'Requirement not found')

  const updated = await prisma.caseRequirement.update({
    where: { id: reqRow.id },
    data: { isSubmitted: payload.isSubmitted, notes: payload.notes ?? null, submittedAt: payload.isSubmitted ? new Date() : null },
  })

  if (reqRow.isSubmitted !== payload.isSubmitted || (reqRow.notes ?? null) !== (payload.notes ?? null)) {
    await auditLog(prisma, {
      caseId: caseData.id,
      changedById: req.user?.id,
      fromStatus: caseData.status,
      toStatus: caseData.status,
      notes: `Requirement ${updated.requirementName} updated (${payload.isSubmitted ? 'submitted' : 'not submitted'})`,
    })
  }

  res.json({ id: updated.id, key: updated.requirementName, isSubmitted: updated.isSubmitted, notes: updated.notes, submittedAt: updated.submittedAt })
}
