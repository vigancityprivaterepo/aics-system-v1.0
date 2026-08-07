import type { Request, Response } from 'express'
import { AssistanceType, Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { currencyFromDb, parseOptionalCurrency } from '../utils/currency.js'
import { computeMedicineTotal } from '../utils/business.js'
import { generateCaseCaseNumber } from '../utils/caseNumber.js'
import { findCaseWithDetails, getApprovalSettings } from '../queries/caseQueries.js'
import { serializeCase, normalizeWorkflowStatus } from '../serializers/caseSerializer.js'
import { resolveApprovalAssignees } from '../services/approvalService.js'
import { activeReportSignatureStage, userCanUploadReportSignatureStage } from '../services/reportSignatureService.js'
import { assessCaseWorkflow } from '../services/caseWorkflowService.js'
import { allowedCaseTypesForUser, assertAllowedCaseTypeForUser, assertCaseReadable, assertEditableCase, casePermissions, ensureRequirementRows, paramId } from '../services/caseService.js'
import { APPROVAL_STAGE_META, APPROVAL_STAGE_ORDER } from '../types/caseTypes.js'
import { updateCaseSchema } from '../schemas/caseSchemas.js'
import { statusToApprovalStage } from '../services/approvalService.js'
import { auditLog } from '../utils/auditLog.js'
import { resetApprovalsAfterMaterialEdit, valuesDiffer } from '../services/workflowIntegrityService.js'
import { normalizePlainAssistanceKinds } from '../utils/requirements.js'
import { findRepeatAssistanceConflicts, repeatAssistanceConflict } from '../services/repeatAssistanceService.js'
import { logger } from '../utils/logger.js'

function formatApprovalSummary(stage: 'for_review' | 'recommending_approval' | 'for_approval', approval: {
  actedByName: string | null
  actedAt: Date | null
  action: 'approved' | 'rejected'
} | null) {
  if (!approval?.actedAt || !approval?.actedByName) return null

  const verb =
    stage === 'for_review'
      ? approval.action === 'rejected' ? 'rejected' : 'reviewed'
      : stage === 'recommending_approval'
        ? approval.action === 'rejected' ? 'rejected' : 'recommended this application'
        : approval.action === 'rejected' ? 'rejected' : 'approved this application'

  return {
    stage,
    actorName: approval.actedByName,
    actedAt: approval.actedAt.toISOString(),
    action: approval.action,
    message:
      stage === 'for_review'
        ? `${approval.actedByName} ${verb} this application on ${approval.actedAt.toISOString().slice(0, 10)}.`
        : `${approval.actedByName} ${verb} on ${approval.actedAt.toISOString().slice(0, 10)}.`,
  }
}

function userCanManageCaseSigning(caseData: { socialWorkerId: string | null }, user: Express.AuthUser | undefined) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (caseData.socialWorkerId && caseData.socialWorkerId === user.id) return true
  return ['reviewer', 'recommender', 'approver'].some((level) => user.approvalLevel.includes(level))
}

function withReportSignaturePermissions(serialized: any, caseData: any, user: Express.AuthUser | undefined) {
  if (!serialized.reportSignature) return serialized
  const activeStage = serialized.reportSignature.activeStageKey
    ? serialized.reportSignature.stages.find((stage: any) => stage.key === serialized.reportSignature.activeStageKey) ?? null
    : null
  return {
    ...serialized,
    reportSignature: {
      ...serialized.reportSignature,
      canPrepare:
        ['intake', 'encoding', 'requirements', 'for_review', 'recommending_approval', 'for_approval'].includes(String(caseData.status ?? '')) &&
        userCanManageCaseSigning(caseData, user),
      canUploadCurrentStage: userCanUploadReportSignatureStage(user, activeStage, caseData) &&
        serialized.reportSignature.readyForCurrentStageSigning,
      currentStageAssignedToCurrentUser: userCanUploadReportSignatureStage(user, activeStage, caseData),
      activeStageKey: activeReportSignatureStage(caseData.status),
    },
  }
}

async function loadRepeatAssistanceCooldownDays() {
  try {
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
      select: { repeatAssistanceCooldownDays: true },
    })
    return settings.repeatAssistanceCooldownDays
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '')
    if (!message.toLowerCase().includes('repeatassistancecooldowndays') && !message.toLowerCase().includes('repeat_assistance_cooldown_days')) {
      throw error
    }

    logger.warn('Falling back to default repeat assistance cooldown because the database schema is missing repeat_assistance_cooldown_days.', {})
    return 90
  }
}

export async function listCases(req: Request, res: Response) {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const type = req.query.type ? String(req.query.type) : undefined
  const status = req.query.status ? String(req.query.status) : undefined
  const search = req.query.search ? String(req.query.search).trim() : undefined
  const queue = req.query.queue ? String(req.query.queue).trim() : undefined
  const owner = req.query.owner ? String(req.query.owner).trim() : undefined
  const blocked = req.query.blocked === 'true'
  const overdue = req.query.overdue === 'true'
  const limit = Math.min(Number(req.query.limit ?? 15), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  if (type) {
    assertAllowedCaseTypeForUser(type as AssistanceType, req.user, 'Case list')
  }

  const allowedAssistanceTypes = allowedCaseTypesForUser(req.user)

  const where: Prisma.CaseWhereInput = {
    ...(type ? { assistanceType: type as AssistanceType } : allowedAssistanceTypes ? { assistanceType: { in: allowedAssistanceTypes } } : {}),
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
            { beneficiaryName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [settings, cases] = await Promise.all([
    getApprovalSettings(),
    prisma.case.findMany({
      where,
      include: {
        client: true,
        requirements: true,
        medicines: true,
        burialDetails: true,
        hospitalDetails: true,
        medicalDetails: true,
        eyeglassDetails: true,
        plainDetails: true,
        applicantApplication: {
          select: {
            id: true,
          },
        },
        approvals: {
          orderBy: { actedAt: 'asc' },
          select: {
            stage: true,
            action: true,
            actedAt: true,
            actedByName: true,
          },
        },
        statusLogs: {
          orderBy: { changedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const assigneesByStage = await resolveApprovalAssignees(settings)

  const hydratedCases = cases.map((c) => {
    const workflow = assessCaseWorkflow(c, assigneesByStage)
    const approvalsByStage = new Map((c.approvals ?? []).map((approval) => [approval.stage, approval]))
    const reviewedSummary = formatApprovalSummary('for_review', approvalsByStage.get('for_review') as any ?? null)
    const recommendedSummary = formatApprovalSummary('recommending_approval', approvalsByStage.get('recommending_approval') as any ?? null)
    const approvedSummary = formatApprovalSummary('for_approval', approvalsByStage.get('for_approval') as any ?? null)
    const latestApprovalSummary = approvedSummary ?? recommendedSummary ?? reviewedSummary ?? null

    return {
      id: c.id,
      caseNumber: (c as any).caseNumber ?? null,
      client: {
        id: c.client.id,
        caseNumber: c.client.caseNumber,
        firstName: c.client.firstName,
        lastName: c.client.lastName,
      },
      clientName: `${c.client.lastName}, ${c.client.firstName}`,
      beneficiaryName: (c as any).beneficiaryName ?? null,
      assistanceType: c.assistanceType,
      status: normalizeWorkflowStatus(c.status),
      socialWorkerId: c.socialWorkerId,
      socialWorkerName: c.socialWorkerName,
      dateOfAssessment: c.dateOfAssessment?.toISOString().slice(0, 10) ?? null,
      amount: currencyFromDb(c.amount),
      createdAt: c.createdAt,
      approvalSummary: {
        latest: latestApprovalSummary,
        for_review: reviewedSummary,
        recommending_approval: recommendedSummary,
        for_approval: approvedSummary,
      },
      permissions: casePermissions(c, req.user),
      ...workflow,
      workflow,
    }
  }).filter((c) => {
    if (queue && c.queue !== queue) return false
    if (blocked && !c.isBlocked) return false
    if (overdue && !c.overdue) return false
    if (owner === 'me' && c.ownerUserId !== req.user!.id) return false
    if (owner && owner !== 'me' && c.ownerUserId !== owner) return false
    return true
  })

  const total = hydratedCases.length
  const pagedCases = hydratedCases.slice((page - 1) * limit, page * limit)

  res.json({
    total,
    page,
    limit,
    cases: pagedCases,
  })
}

export async function getCase(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Case details')

  const plainAssistanceKinds = normalizePlainAssistanceKinds((caseData.auditFlags as any)?.plain_assistance_kinds)
  await ensureRequirementRows(caseData.id, caseData.assistanceType, plainAssistanceKinds)
  const refreshed = await findCaseWithDetails(caseData.id)
  if (!refreshed) throw new HttpError(404, 'Case not found')

  const settings = await getApprovalSettings()
  const assigneeByStage = await resolveApprovalAssignees(settings)
  const serialized = withReportSignaturePermissions(serializeCase(refreshed, assigneeByStage), refreshed, req.user)
  const permissions = casePermissions(refreshed, req.user)

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

  res.json({ ...serialized, permissions, approvalAssignees: assigneeDisplayByStage, currentApprovalStage: currentStage, reviewFlow })
}

export async function createCase(req: Request, res: Response) {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const { createCaseSchema } = await import('../schemas/caseSchemas.js')
  const body = createCaseSchema.parse(req.body)
  const { clientId, assistanceType } = body
  assertAllowedCaseTypeForUser(assistanceType, req.user, 'Case creation')

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new HttpError(404, 'Client not found')
  const cooldownDays = await loadRepeatAssistanceCooldownDays()
  const repeatConflicts = await findRepeatAssistanceConflicts(prisma, {
    clientId,
    cooldownDays,
    beneficiaryName: body.beneficiaryName ?? null,
  })
  if (repeatConflicts.hasConflicts) {
    throw repeatAssistanceConflict(repeatConflicts)
  }

  const created = await prisma.$transaction(async (tx) => {
    const newCaseNumber = await generateCaseCaseNumber(assistanceType, tx)
    const createdCase = await tx.case.create({
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
        familyComposition: body.familyComposition ?? (Array.isArray((client as any).familyComposition) ? (client as any).familyComposition as any : undefined),
        backgroundOfProblem: body.backgroundOfProblem ?? null,
        assessment: body.assessment ?? null,
        recommendation: body.recommendation ?? null,
        hospitalClinic: body.hospitalClinic ?? null,
        remarks: body.remarks ?? null,
        beneficiaryName: body.beneficiaryName ?? null,
        beneficiaryAge: body.beneficiaryAge != null ? String(body.beneficiaryAge) : null,
        beneficiarySex: body.beneficiarySex ?? null,
        beneficiaryCivilStatus: body.beneficiaryCivilStatus ?? null,
        beneficiaryOccupation: body.beneficiaryOccupation ?? null,
        beneficiaryRequestorName: body.beneficiaryRequestorName ?? null,
        beneficiaryRequestorRelationship: body.beneficiaryRequestorRelationship ?? null,
      },
      include: { client: true },
    })

    if (
      assistanceType === 'burial' &&
      (body.deceasedName || body.dateOfDeath || body.causeOfDeath || body.funeralHome || body.funeralHomeOwner || body.funeralOwnerAddress)
    ) {
      await tx.burialDetail.create({
        data: {
          caseId: createdCase.id,
          deceasedName: body.deceasedName ?? null,
          dateOfDeath: body.dateOfDeath ? new Date(body.dateOfDeath) : null,
          causeOfDeath: body.causeOfDeath ?? null,
          funeralHome: body.funeralHome ?? null,
          funeralHomeOwner: body.funeralHomeOwner ?? null,
          funeralOwnerAddress: body.funeralOwnerAddress ?? null,
        },
      })
    }

    await auditLog(tx, {
      caseId: createdCase.id,
      changedById: req.user?.id,
      fromStatus: 'intake',
      toStatus: 'intake',
      notes: 'Case intake submitted',
    })

    return createdCase
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

  if (current.assistanceType === 'medicine' && body.medicineTemplateType !== undefined) {
    auditFlags.medicine_template_type = body.medicineTemplateType === 'proxy' ? 'proxy' : 'personal'
  }
  if (current.assistanceType === 'medicine') {
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

  const nextDateOfAssessment =
    body.dateOfAssessment !== undefined
      ? (body.dateOfAssessment ? new Date(body.dateOfAssessment) : null)
      : current.dateOfAssessment
  const nextFamilyComposition = body.familyComposition !== undefined ? body.familyComposition : current.familyComposition
  const nextBackground = body.backgroundOfProblem !== undefined ? body.backgroundOfProblem : current.backgroundOfProblem
  const nextAssessment = body.assessment !== undefined ? body.assessment : current.assessment
  const nextRecommendation = body.recommendation !== undefined ? body.recommendation : current.recommendation
  const nextHospitalClinic = body.hospitalClinic !== undefined ? body.hospitalClinic : current.hospitalClinic
  const nextRemarks = body.remarks !== undefined ? body.remarks : current.remarks
  const nextBeneficiaryName = body.beneficiaryName !== undefined ? body.beneficiaryName : current.beneficiaryName
  const nextBeneficiaryAge = body.beneficiaryAge !== undefined ? (body.beneficiaryAge != null ? String(body.beneficiaryAge) : null) : current.beneficiaryAge
  const nextBeneficiarySex = body.beneficiarySex !== undefined ? body.beneficiarySex : current.beneficiarySex
  const nextBeneficiaryCivilStatus = body.beneficiaryCivilStatus !== undefined ? body.beneficiaryCivilStatus : current.beneficiaryCivilStatus
  const nextBeneficiaryOccupation = body.beneficiaryOccupation !== undefined ? body.beneficiaryOccupation : current.beneficiaryOccupation
  const nextBeneficiaryRequestorName = body.beneficiaryRequestorName !== undefined ? body.beneficiaryRequestorName : current.beneficiaryRequestorName
  const nextBeneficiaryRequestorRelationship = body.beneficiaryRequestorRelationship !== undefined ? body.beneficiaryRequestorRelationship : current.beneficiaryRequestorRelationship
  const nextSocialWorkerName = body.socialWorkerName !== undefined ? body.socialWorkerName : current.socialWorkerName
  const nextSocialWorkerEmpId = body.socialWorkerEmpId !== undefined ? body.socialWorkerEmpId : current.socialWorkerEmpId
  const nextPresentingProblem = body.presentingProblem !== undefined ? body.presentingProblem : current.presentingProblem
  const nextAmount = requestedAmount !== null ? requestedAmount : current.amount == null ? null : Number(current.amount)
  const nextMedicineTemplateType = auditFlags.medicine_template_type === 'proxy' ? 'proxy' : 'personal'
  const nextMedicineConformeName = typeof auditFlags.medicine_conforme_name === 'string' ? auditFlags.medicine_conforme_name : null
  const nextMedicineConformeRelationship =
    typeof auditFlags.medicine_conforme_relationship === 'string' ? auditFlags.medicine_conforme_relationship : null
  const nextEyeglassTemplateType = auditFlags.eyeglass_template_type === 'proxy' ? 'proxy' : 'personal'

  const changedFields: string[] = []
  if (body.dateOfAssessment !== undefined && valuesDiffer(current.dateOfAssessment?.toISOString().slice(0, 10) ?? null, nextDateOfAssessment?.toISOString().slice(0, 10) ?? null)) changedFields.push('dateOfAssessment')
  if (body.socialWorkerName !== undefined && valuesDiffer(current.socialWorkerName ?? null, nextSocialWorkerName ?? null)) changedFields.push('socialWorkerName')
  if (body.socialWorkerEmpId !== undefined && valuesDiffer(current.socialWorkerEmpId ?? null, nextSocialWorkerEmpId ?? null)) changedFields.push('socialWorkerEmpId')
  if (body.presentingProblem !== undefined && valuesDiffer(current.presentingProblem ?? null, nextPresentingProblem ?? null)) changedFields.push('presentingProblem')
  if (body.familyComposition !== undefined && valuesDiffer(current.familyComposition ?? null, nextFamilyComposition ?? null)) changedFields.push('familyComposition')
  if (body.backgroundOfProblem !== undefined && valuesDiffer(current.backgroundOfProblem ?? null, nextBackground ?? null)) changedFields.push('backgroundOfProblem')
  if (body.assessment !== undefined && valuesDiffer(current.assessment ?? null, nextAssessment ?? null)) changedFields.push('assessment')
  if (body.recommendation !== undefined && valuesDiffer(current.recommendation ?? null, nextRecommendation ?? null)) changedFields.push('recommendation')
  if (body.amount !== undefined && valuesDiffer(current.amount == null ? null : Number(current.amount), nextAmount)) changedFields.push('amount')
  if (body.hospitalClinic !== undefined && valuesDiffer(current.hospitalClinic ?? null, nextHospitalClinic ?? null)) changedFields.push('hospitalClinic')
  if (body.remarks !== undefined && valuesDiffer(current.remarks ?? null, nextRemarks ?? null)) changedFields.push('remarks')
  if (body.beneficiaryName !== undefined && valuesDiffer(current.beneficiaryName ?? null, nextBeneficiaryName ?? null)) changedFields.push('beneficiaryName')
  if (body.beneficiaryAge !== undefined && valuesDiffer(current.beneficiaryAge ?? null, nextBeneficiaryAge ?? null)) changedFields.push('beneficiaryAge')
  if (body.beneficiarySex !== undefined && valuesDiffer(current.beneficiarySex ?? null, nextBeneficiarySex ?? null)) changedFields.push('beneficiarySex')
  if (body.beneficiaryCivilStatus !== undefined && valuesDiffer(current.beneficiaryCivilStatus ?? null, nextBeneficiaryCivilStatus ?? null)) changedFields.push('beneficiaryCivilStatus')
  if (body.beneficiaryOccupation !== undefined && valuesDiffer(current.beneficiaryOccupation ?? null, nextBeneficiaryOccupation ?? null)) changedFields.push('beneficiaryOccupation')
  if (body.beneficiaryRequestorName !== undefined && valuesDiffer(current.beneficiaryRequestorName ?? null, nextBeneficiaryRequestorName ?? null)) changedFields.push('beneficiaryRequestorName')
  if (body.beneficiaryRequestorRelationship !== undefined && valuesDiffer(current.beneficiaryRequestorRelationship ?? null, nextBeneficiaryRequestorRelationship ?? null)) changedFields.push('beneficiaryRequestorRelationship')
  if (current.assistanceType === 'medicine') {
    const currentMedicineTemplateType = typeof (current.auditFlags as any)?.medicine_template_type === 'string' && (current.auditFlags as any).medicine_template_type === 'proxy' ? 'proxy' : 'personal'
    const currentMedicineConformeName = typeof (current.auditFlags as any)?.medicine_conforme_name === 'string' ? (current.auditFlags as any).medicine_conforme_name : null
    const currentMedicineConformeRelationship = typeof (current.auditFlags as any)?.medicine_conforme_relationship === 'string' ? (current.auditFlags as any).medicine_conforme_relationship : null
    if (body.medicineTemplateType !== undefined && valuesDiffer(currentMedicineTemplateType, nextMedicineTemplateType)) changedFields.push('medicineTemplateType')
    if (body.medicineConformeName !== undefined && valuesDiffer(currentMedicineConformeName, nextMedicineConformeName)) changedFields.push('medicineConformeName')
    if (body.medicineConformeRelationship !== undefined && valuesDiffer(currentMedicineConformeRelationship, nextMedicineConformeRelationship)) changedFields.push('medicineConformeRelationship')
  }
  if (current.assistanceType === 'eyeglass' && body.eyeglassTemplateType !== undefined) {
    const currentEyeglassTemplateType = typeof (current.auditFlags as any)?.eyeglass_template_type === 'string' && (current.auditFlags as any).eyeglass_template_type === 'proxy' ? 'proxy' : 'personal'
    if (valuesDiffer(currentEyeglassTemplateType, nextEyeglassTemplateType)) changedFields.push('eyeglassTemplateType')
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.case.update({
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
        beneficiaryName: body.beneficiaryName,
        beneficiaryAge: body.beneficiaryAge !== undefined ? (body.beneficiaryAge != null ? String(body.beneficiaryAge) : null) : undefined,
        beneficiarySex: body.beneficiarySex,
        beneficiaryCivilStatus: body.beneficiaryCivilStatus,
        beneficiaryOccupation: body.beneficiaryOccupation,
        beneficiaryRequestorName: body.beneficiaryRequestorName,
        beneficiaryRequestorRelationship: body.beneficiaryRequestorRelationship,
        auditFlags: auditFlags as Prisma.InputJsonValue,
      },
    })

    if (changedFields.length > 0) {
      if (current.assistanceType === 'burial') {
        await tx.burialDetail.updateMany({ where: { caseId }, data: { signedGlUrl: null, glUploadedAt: null } })
      } else if (current.assistanceType === 'hospital') {
        await tx.hospitalDetail.updateMany({ where: { caseId }, data: { signedGlUrl: null, glUploadedAt: null } })
      } else if (current.assistanceType === 'medical') {
        await tx.medicalDetail.updateMany({ where: { caseId }, data: { signedGlUrl: null, glUploadedAt: null } })
      }
    }

    const resetResult = await resetApprovalsAfterMaterialEdit(tx, {
      caseId: current.id,
      changedById: req.user?.id,
      changedFields,
      reason: overrideReason ?? null,
    })

    return { updated, resetResult }
  })

  res.json({
    id: result.updated.id,
    status: result.resetResult.status ?? result.updated.status,
    amount: currencyFromDb(result.updated.amount),
    approvalsReset: result.resetResult.approvalsReset,
  })
}

export async function deleteCase(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Case delete')

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
    return res.json({ byType: {}, total: 0, pendingStatuses: [], recentCases: [] })
  }

  const [grouped, recent] = await Promise.all([
    prisma.case.groupBy({
      by: ['assistanceType'],
      where: { status: { in: pendingStatuses } },
      _count: { _all: true },
    }),
    // Oldest-waiting-first (not newest-first) — this backs a "what needs my action"
    // panel, not an activity feed, so the case that's been sitting longest surfaces first.
    prisma.case.findMany({
      where: { status: { in: pendingStatuses } },
      orderBy: { createdAt: 'asc' },
      take: 6,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
  ])

  const byType: Record<string, number> = {}
  let total = 0
  for (const row of grouped) {
    byType[row.assistanceType] = row._count._all
    total += row._count._all
  }

  const queueByStatus: Record<string, string> = {
    for_review: 'ready_for_review',
    recommending_approval: 'waiting_for_recommender',
    for_approval: 'waiting_for_approver',
  }

  const recentCases = recent.map((c) => ({
    id: c.id,
    caseNumber: c.caseNumber ?? null,
    assistanceType: c.assistanceType,
    beneficiaryName: (c as any).beneficiaryName ?? null,
    clientName: `${c.client.lastName}, ${c.client.firstName}`,
    queue: queueByStatus[c.status] ?? null,
    createdAt: c.createdAt,
  }))

  return res.json({ byType, total, pendingStatuses, recentCases })
}

