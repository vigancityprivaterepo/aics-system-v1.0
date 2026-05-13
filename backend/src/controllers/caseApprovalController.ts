import type { Request, Response } from 'express'
import { ApplicantApplicationStatus, ApprovalAction, type CaseStatus } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { APPROVAL_STAGE_META } from '../types/caseTypes.js'
import { getApprovalSettings } from '../queries/caseQueries.js'
import { updateStatusSchema } from '../schemas/caseSchemas.js'
import { paramId, assertCaseReadable, normalizeWorkflowStatus, caseStatusToStep } from '../services/caseService.js'
import {
  resolveApprovalAssignees,
  statusToApprovalStage,
  isApprovalProgressTransition,
  approvalActorTitle,
  requiredApprovalLevel,
  parseApprovalLevels,
  assertTransitionPermission,
  normalizeApprovalNotes,
} from '../services/approvalService.js'
import { sendPortalStatusNotifications } from '../services/portalStatusNotifications.js'
import { auditLog } from '../utils/auditLog.js'

export async function updateStatus(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const { status: nextStatus, notes } = updateStatusSchema.parse(req.body)
  const normalizedNotes = normalizeApprovalNotes(notes)

  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      requirements: true,
      burialDetails: true,
      hospitalDetails: true,
      medicalDetails: true,
      eyeglassDetails: true,
    },
  })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Case status')

  if (caseData.status === nextStatus) {
    return res.json({ id: caseData.id, status: caseData.status })
  }

  const currentStatus = normalizeWorkflowStatus(caseData.status)
  const currentStep = caseStatusToStep(currentStatus)
  const nextStep = caseStatusToStep(nextStatus as CaseStatus)
  const isReject = nextStatus === 'rejected'
  const isForward = nextStep === currentStep + 1
  const isAllowedBackward =
    (currentStatus === 'encoding' && nextStatus === 'intake') ||
    (['for_review', 'recommending_approval', 'for_approval'].includes(currentStatus) && nextStatus === 'encoding') ||
    (currentStatus === 'rejected' && nextStatus === 'encoding')

  if (!isReject && !(isForward || isAllowedBackward)) {
    throw new HttpError(400, 'Invalid status transition')
  }

  assertTransitionPermission(currentStatus, nextStatus as CaseStatus, req.user, normalizedNotes ?? undefined)

  const currentStage = statusToApprovalStage(caseData.status)
  const shouldCaptureStageAction = !!currentStage && (isApprovalProgressTransition(caseData.status, nextStatus as CaseStatus) || isReject)
  let stageAssignee = null

  if (shouldCaptureStageAction && currentStage) {
    const settings = await getApprovalSettings()
    const stageAssignees = await resolveApprovalAssignees(settings)
    const expectedLevel = requiredApprovalLevel(currentStage)
    stageAssignee = stageAssignees[currentStage]

    if (!stageAssignee) {
      throw new HttpError(400, `No active user found with ${expectedLevel} approval level for ${APPROVAL_STAGE_META[currentStage].label}.`)
    }
    if (!stageAssignee.isActive) {
      throw new HttpError(400, `Assigned ${APPROVAL_STAGE_META[currentStage].label.toLowerCase()} user must be active.`)
    }
    const assigneeLevels = parseApprovalLevels(stageAssignee.approvalLevel)
    if (!assigneeLevels.includes(expectedLevel)) {
      throw new HttpError(403, `Assigned approver must have ${expectedLevel} approval level.`)
    }

    const actingUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, approvalLevel: true, isActive: true },
    })
    if (!actingUser || !actingUser.isActive) throw new HttpError(403, 'Your account is inactive.')
    const actorLevels = parseApprovalLevels(actingUser.approvalLevel)
    if (!actorLevels.includes(expectedLevel)) {
      throw new HttpError(403, `Only users with ${expectedLevel} approval level can perform this action.`)
    }

    if (isApprovalProgressTransition(caseData.status, nextStatus as CaseStatus) && !stageAssignee.eSignatureUrl) {
      throw new HttpError(400, `Assigned ${APPROVAL_STAGE_META[currentStage].label.toLowerCase()} must have an e-signature before approval.`)
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.case.update({ where: { id: caseData.id }, data: { status: nextStatus as CaseStatus } })

    if (shouldCaptureStageAction && currentStage && stageAssignee) {
      const action: ApprovalAction = isReject ? 'rejected' : 'approved'
      const actedAt = new Date()
      await tx.caseApproval.upsert({
        where: { caseId_stage: { caseId: caseData.id, stage: currentStage } },
        create: {
          caseId: caseData.id,
          stage: currentStage,
          actedByUserId: stageAssignee.id,
          actedByName: stageAssignee.name,
          actedByTitle: approvalActorTitle(currentStage),
          signatureUrlSnapshot: stageAssignee.eSignatureUrl,
          actedAt,
          action,
          notes: normalizedNotes,
        },
        update: {
          actedByUserId: stageAssignee.id,
          actedByName: stageAssignee.name,
          actedByTitle: approvalActorTitle(currentStage),
          signatureUrlSnapshot: stageAssignee.eSignatureUrl,
          actedAt,
          action,
          notes: normalizedNotes,
        },
      })
    }

    await auditLog(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      fromStatus: caseData.status,
      toStatus: nextStatus as CaseStatus,
      notes: normalizedNotes,
    })

    const portalApplicationStatus =
      nextStatus === 'released'
        ? ApplicantApplicationStatus.released
        : nextStatus === 'approved'
          ? ApplicantApplicationStatus.approved
          : nextStatus === 'rejected'
            ? ApplicantApplicationStatus.disapproved
            : null

    if (portalApplicationStatus) {
      await tx.applicantApplication.updateMany({
        where: { caseId: caseData.id },
        data: {
          status: portalApplicationStatus,
          reviewedAt: new Date(),
          ...(normalizedNotes ? { adminNotes: normalizedNotes } : {}),
        },
      })
    }

    return next
  })

  if (['for_review', 'recommending_approval', 'for_approval', 'approved', 'released', 'rejected'].includes(nextStatus)) {
    const linkedApplication = await prisma.applicantApplication.findFirst({
      where: { caseId: caseData.id },
      include: { applicant: { select: { firstName: true, email: true, mobileNumber: true } } },
    })
    if (linkedApplication) {
      sendPortalStatusNotifications({ ...linkedApplication, status: nextStatus, adminNotes: normalizedNotes }).catch(console.error)
    }
  }

  res.json({ id: updated.id, status: updated.status })
}
