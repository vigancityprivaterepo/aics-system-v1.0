import type { Request, Response } from 'express'
import { AssistanceType, Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { currencyFromDb, parseOptionalCurrency } from '../utils/currency.js'
import { computeMedicineTotal } from '../utils/business.js'
import { generateCaseCaseNumber } from '../utils/caseNumber.js'
import { findCaseWithDetails, getApprovalSettings } from '../queries/caseQueries.js'
import { serializeCase, portalContextFromAuditFlags, normalizeWorkflowStatus } from '../serializers/caseSerializer.js'
import { resolveApprovalAssignees } from '../services/approvalService.js'
import { assertCaseReadable, assertEditableCase, ensureRequirementRows, paramId } from '../services/caseService.js'
import { APPROVAL_STAGE_META, APPROVAL_STAGE_ORDER } from '../types/caseTypes.js'
import { generateClaudeFindingsDraft } from '../services/aiService.js'
import { generateFindingsSchema, updateCaseSchema } from '../schemas/caseSchemas.js'
import { statusToApprovalStage } from '../services/approvalService.js'
import { auditLog } from '../utils/auditLog.js'

export async function listCases(req: Request, res: Response) {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const type = req.query.type ? String(req.query.type) : undefined
  const status = req.query.status ? String(req.query.status) : undefined
  const search = req.query.search ? String(req.query.search).trim() : undefined
  const limit = Math.min(Number(req.query.limit ?? 15), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  const where: Prisma.CaseWhereInput = {
    ...(type ? { assistanceType: type as AssistanceType } : {}),
    ...(status
      ? {
          status:
            status === 'encoding'
              ? { in: ['encoding', 'requirements'] as any }
              : (status as any),
        }
      : {}),
    ...(search
      ? {
          OR: [
            { caseNumber: { contains: search, mode: 'insensitive' } },
            { client: { is: { caseNumber: { contains: search, mode: 'insensitive' } } } },
            { client: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
            { client: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  }

  const [total, cases] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({
      where,
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({
    total,
    page,
    limit,
    cases: cases.map((c) => ({
      id: c.id,
      caseNumber: (c as any).caseNumber ?? null,
      client: {
        id: c.client.id,
        caseNumber: c.client.caseNumber,
        firstName: c.client.firstName,
        lastName: c.client.lastName,
      },
      assistanceType: c.assistanceType,
      status: normalizeWorkflowStatus(c.status),
      socialWorkerName: c.socialWorkerName,
      dateOfAssessment: c.dateOfAssessment?.toISOString().slice(0, 10) ?? null,
      amount: currencyFromDb(c.amount),
      createdAt: c.createdAt,
    })),
  })
}

export async function getCase(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Case details')

  await ensureRequirementRows(caseData.id, caseData.assistanceType)
  const refreshed = await findCaseWithDetails(caseData.id)
  if (!refreshed) throw new HttpError(404, 'Case not found')

  const settings = await getApprovalSettings()
  const assigneeByStage = await resolveApprovalAssignees(settings)
  const serialized = serializeCase(refreshed, assigneeByStage)

  const assigneeDisplayByStage = {
    for_review: assigneeByStage.for_review
      ? { id: assigneeByStage.for_review.id, name: assigneeByStage.for_review.name, approvalLevel: assigneeByStage.for_review.approvalLevel }
      : null,
    recommending_approval: assigneeByStage.recommending_approval
      ? { id: assigneeByStage.recommending_approval.id, name: assigneeByStage.recommending_approval.name, approvalLevel: assigneeByStage.recommending_approval.approvalLevel }
      : null,
    for_approval: assigneeByStage.for_approval
      ? { id: assigneeByStage.for_approval.id, name: assigneeByStage.for_approval.name, approvalLevel: assigneeByStage.for_approval.approvalLevel }
      : null,
  }

  const currentStage = statusToApprovalStage(refreshed.status)
  const currentIndex = currentStage
    ? APPROVAL_STAGE_ORDER.indexOf(currentStage)
    : refreshed.status === 'approved' || refreshed.status === 'released'
      ? APPROVAL_STAGE_ORDER.length
      : -1

  const reviewFlow = APPROVAL_STAGE_ORDER.map((stage, index) => {
    const approval = serialized.approvals?.[stage] ?? null
    const state = approval
      ? approval.action
      : currentIndex === index
        ? 'current'
        : currentIndex > index
          ? 'completed'
          : 'pending'
    return {
      stage,
      label: APPROVAL_STAGE_META[stage].label,
      title: APPROVAL_STAGE_META[stage].title,
      assignee: assigneeDisplayByStage[stage],
      state,
      approval,
    }
  })

  res.json({ ...serialized, approvalAssignees: assigneeDisplayByStage, currentApprovalStage: currentStage, reviewFlow })
}

export async function createCase(req: Request, res: Response) {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const { createCaseSchema } = await import('../schemas/caseSchemas.js')
  const body = createCaseSchema.parse(req.body)
  const { clientId, assistanceType } = body

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new HttpError(404, 'Client not found')

  const newCaseNumber = await generateCaseCaseNumber(assistanceType)

  const created = await prisma.case.create({
    data: {
      clientId,
      caseNumber: newCaseNumber,
      assistanceType,
      status: 'intake',
      socialWorkerId: req.user?.id,
      socialWorkerName: req.user?.name,
      socialWorkerEmpId: req.user?.employeeId,
      dateOfAssessment: body.dateOfAssessment ? new Date(body.dateOfAssessment) : null,
      presentingProblem: body.presentingProblem ?? null,
      familyComposition: body.familyComposition ?? undefined,
      backgroundOfProblem: body.backgroundOfProblem ?? null,
      assessment: body.assessment ?? null,
      recommendation: body.recommendation ?? null,
      hospitalClinic: body.hospitalClinic ?? null,
      remarks: body.remarks ?? null,
    },
    include: { client: true },
  })

  if (
    assistanceType === 'burial' &&
    (body.deceasedName || body.dateOfDeath || body.causeOfDeath || body.funeralHome || body.funeralHomeOwner || body.funeralOwnerAddress)
  ) {
    await prisma.burialDetail.create({
      data: {
        caseId: created.id,
        deceasedName: body.deceasedName ?? null,
        dateOfDeath: body.dateOfDeath ? new Date(body.dateOfDeath) : null,
        causeOfDeath: body.causeOfDeath ?? null,
        funeralHome: body.funeralHome ?? null,
        funeralHomeOwner: body.funeralHomeOwner ?? null,
        funeralOwnerAddress: body.funeralOwnerAddress ?? null,
      },
    })
  }

  await auditLog(prisma, {
    caseId: created.id,
    changedById: req.user?.id,
    fromStatus: 'intake',
    toStatus: 'intake',
    notes: 'Case intake submitted',
  })

  res.status(201).json({
    id: created.id,
    caseNumber: created.caseNumber ?? created.client.caseNumber,
    status: created.status,
    assistanceType: created.assistanceType,
  })
}

export async function updateCase(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = updateCaseSchema.parse(req.body)

  const current = await prisma.case.findUnique({ where: { id: caseId }, include: { medicines: true } })
  if (!current) throw new HttpError(404, 'Case not found')
  assertEditableCase(current, req.user, 'Case details')

  const computedMedicineTotal = computeMedicineTotal(current.medicines)
  const requestedAmount = parseOptionalCurrency(body.amount)
  const overrideReason = body.overrideReason?.trim()

  const auditFlags = {
    ...(typeof current.auditFlags === 'object' && current.auditFlags
      ? (current.auditFlags as Record<string, unknown>)
      : {}),
  } as Record<string, unknown>

  if (current.assistanceType === 'medicine' && requestedAmount != null) {
    const mismatch = Math.abs(requestedAmount - computedMedicineTotal) > 0.01
    if (mismatch) {
      if (!overrideReason) {
        throw new HttpError(400, 'Override reason is required when amount does not match encoded medicines.')
      }
      auditFlags.manual_amount_override = true
      auditFlags.computed_total = computedMedicineTotal
      auditFlags.override_reason = overrideReason
      auditFlags.override_by = req.user?.id ?? null
      auditFlags.override_at = new Date().toISOString()
    } else {
      auditFlags.manual_amount_override = false
      auditFlags.computed_total = computedMedicineTotal
      delete auditFlags.override_reason
      delete auditFlags.override_by
      delete auditFlags.override_at
    }
  }

  if (current.assistanceType === 'medicine') {
    auditFlags.medicine_template_type = body.medicineTemplateType === 'proxy' ? 'proxy' : 'personal'
    if (body.medicineConformeName !== undefined) {
      const v = String(body.medicineConformeName ?? '').trim()
      if (v) auditFlags.medicine_conforme_name = v
      else delete auditFlags.medicine_conforme_name
    }
    if (body.medicineConformeRelationship !== undefined) {
      const v = String(body.medicineConformeRelationship ?? '').trim()
      if (v) auditFlags.medicine_conforme_relationship = v
      else delete auditFlags.medicine_conforme_relationship
    }
  }

  if (current.assistanceType === 'eyeglass' && body.eyeglassTemplateType !== undefined) {
    auditFlags.eyeglass_template_type = body.eyeglassTemplateType === 'proxy' ? 'proxy' : 'personal'
  }

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      dateOfAssessment: body.dateOfAssessment
        ? new Date(body.dateOfAssessment)
        : body.dateOfAssessment === null
          ? null
          : undefined,
      socialWorkerName: body.socialWorkerName,
      socialWorkerEmpId: body.socialWorkerEmpId,
      presentingProblem: body.presentingProblem,
      familyComposition: body.familyComposition,
      backgroundOfProblem: body.backgroundOfProblem,
      assessment: body.assessment,
      recommendation: body.recommendation,
      amount: requestedAmount,
      hospitalClinic: body.hospitalClinic,
      remarks: body.remarks,
      auditFlags: auditFlags as Prisma.InputJsonValue,
    },
  })

  res.json({ id: updated.id, status: updated.status, amount: currencyFromDb(updated.amount) })
}

export async function deleteCase(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')

  // NOTE: CaseStatusLog has onDelete: Cascade, so audit entries are deleted
  // along with the case. Permanent delete auditing would require a separate
  // non-cascaded table.
  await prisma.case.delete({ where: { id: caseId } })
  res.status(204).send()
}

export async function pendingApprovalsByType(req: Request, res: Response) {
  const { parseApprovalLevels } = await import('../services/approvalService.js')
  const dbUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { approvalLevel: true },
  })
  const levels = parseApprovalLevels(dbUser?.approvalLevel)

  const pendingStatuses: any[] = []
  if (levels.includes('reviewer')) pendingStatuses.push('for_review')
  if (levels.includes('recommender')) pendingStatuses.push('recommending_approval')
  if (levels.includes('approver')) pendingStatuses.push('for_approval')

  if (pendingStatuses.length === 0) {
    return res.json({ byType: {}, total: 0, pendingStatuses: [] })
  }

  const grouped = await prisma.case.groupBy({
    by: ['assistanceType'],
    where: { status: { in: pendingStatuses } },
    _count: { _all: true },
  })

  const byType: Record<string, number> = {}
  let total = 0
  for (const row of grouped) {
    byType[row.assistanceType] = row._count._all
    total += row._count._all
  }

  return res.json({ byType, total, pendingStatuses })
}

export async function generateFindings(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = generateFindingsSchema.parse(req.body ?? {})

  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Case findings assist')

  const findings = await generateClaudeFindingsDraft({
    assistanceType: caseData.assistanceType,
    presentingProblem: body.presentingProblem ?? caseData.presentingProblem ?? null,
    client: {
      firstName: caseData.client.firstName,
      middleName: caseData.client.middleName,
      lastName: caseData.client.lastName,
      dateOfBirth: caseData.client.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      sex: caseData.client.sex ?? null,
      civilStatus: caseData.client.civilStatus ?? null,
      barangay: caseData.client.barangay ?? null,
      municipality: caseData.client.municipality ?? null,
      province: caseData.client.province ?? null,
      occupation: caseData.client.occupation ?? null,
      contactNumber: caseData.client.contactNumber ?? null,
      is4ps: caseData.client.is4ps,
      isPwd: caseData.client.isPwd,
      isSenior: caseData.client.isSenior,
    },
    familyComposition: caseData.familyComposition ?? [],
    portalContext: portalContextFromAuditFlags(caseData.auditFlags),
  })

  res.json({ findings })
}
