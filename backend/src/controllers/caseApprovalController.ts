import type { Request, Response } from 'express'
import { ApplicantApplicationStatus, ApprovalAction, type CaseStatus } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { ACTIVE_APPROVAL_STATUSES, APPROVAL_STAGE_META } from '../types/caseTypes.js'
import { findCaseWithDetails, getApprovalSettings } from '../queries/caseQueries.js'
import { updateStatusSchema } from '../schemas/caseSchemas.js'
import { paramId, assertCaseReadable, assertEditableCase, normalizeWorkflowStatus, caseStatusToStep } from '../services/caseService.js'
import {
  resolveApprovalAssignees,
  statusToApprovalStage,
  isApprovalProgressTransition,
  approvalActorTitle,
  requiredApprovalLevel,
  parseApprovalLevels,
  assertTransitionPermission,
  normalizeApprovalNotes,
  resolveResubmitStage,
} from '../services/approvalService.js'
import { sendPortalStatusNotifications } from '../services/portalStatusNotifications.js'
import { auditLog } from '../utils/auditLog.js'
import { assessCaseWorkflow } from '../services/caseWorkflowService.js'

// APPROVAL_STAGE_META's `label` is phrased for "Approved by: {label}" display, not for
// naming the stage itself, so audit-log wording about which stage a resumed case landed
// on uses this instead.
const RESUME_STAGE_DESCRIPTION: Record<string, string> = {
  for_review: 'Reviewer',
  recommending_approval: 'Recommender',
  for_approval: 'Final Approver',
}

export async function updateStatus(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const { status: requestedStatus, notes, preserveApprovals } = updateStatusSchema.parse(req.body)
  const normalizedNotes = normalizeApprovalNotes(notes)

  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Case status')

  if (caseData.status === requestedStatus) {
    return res.json({ id: caseData.id, status: caseData.status })
  }

  const currentStatus = normalizeWorkflowStatus(caseData.status)

  // The client always requests 'for_review' when resubmitting from encoding, but if an
  // earlier "minor fix" kickback preserved prior-stage approvals (see preserveApprovals
  // below), the case should resume at the stage that sent it back rather than restarting
  // the whole review -> recommend -> approve chain from scratch.
  let nextStatus: CaseStatus = requestedStatus as CaseStatus
  let isResumeWithPreservedApprovals = false
  if (currentStatus === 'encoding' && requestedStatus === 'for_review') {
    const resumeStage = resolveResubmitStage(caseData.approvals ?? [])
    if (resumeStage !== 'for_review') {
      nextStatus = resumeStage
      isResumeWithPreservedApprovals = true
    }
  }

  const currentStep = caseStatusToStep(currentStatus)
  const nextStep = caseStatusToStep(nextStatus)
  const isReject = nextStatus === 'rejected'
  const isForward = nextStep === currentStep + 1
  const isAllowedBackward =
    (currentStatus === 'encoding' && nextStatus === 'intake') ||
    (['for_review', 'recommending_approval', 'for_approval'].includes(currentStatus) && nextStatus === 'encoding') ||
    (currentStatus === 'rejected' && nextStatus === 'encoding')

  if (!isReject && !isResumeWithPreservedApprovals && !(isForward || isAllowedBackward)) {
    throw new HttpError(400, 'Invalid status transition')
  }

  if (currentStatus === 'encoding' && requestedStatus === 'for_review') {
    assertEditableCase(caseData, req.user, 'Case status')
    const settings = await getApprovalSettings()
    const assigneesByStage = await resolveApprovalAssignees(settings)
    const workflow = assessCaseWorkflow(caseData, assigneesByStage)
    if (!workflow.readyForReview && !normalizedNotes) {
      throw new HttpError(400, `Case is not ready for review. Resolve blockers first or provide an override reason. Blockers: ${workflow.blockers.join('; ')}`)
    }
  }

  if (
    (currentStatus === 'intake' && nextStatus === 'encoding') ||
    (currentStatus === 'encoding' && nextStatus === 'intake') ||
    (ACTIVE_APPROVAL_STATUSES.has(currentStatus) && nextStatus === 'encoding') ||
    (currentStatus === 'rejected' && nextStatus === 'encoding')
  ) {
    assertEditableCase(caseData, req.user, 'Case status')
  }

  assertTransitionPermission(currentStatus, nextStatus, req.user, normalizedNotes ?? undefined)

  const currentStage = statusToApprovalStage(caseData.status)
  const shouldCaptureStageAction = !!currentStage && (isApprovalProgressTransition(caseData.status, nextStatus as CaseStatus) || isReject)
  let stageAssignee = null

  if (shouldCaptureStageAction && currentStage) {
    const settings = await getApprovalSettings()
    const stageAssignees = await resolveApprovalAssignees(settings)
    const expectedLevel = requiredApprovalLevel(currentStage)
    stageAssignee = stageAssignees[currentStage]

    const actingUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, approvalLevel: true, isActive: true, eSignatureUrl: true, position: true },
    })
    if (!actingUser || !actingUser.isActive) throw new HttpError(403, 'Your account is inactive.')
    const actorLevels = parseApprovalLevels(actingUser.approvalLevel)
    if (!actorLevels.includes(expectedLevel)) {
      throw new HttpError(403, `Only users with ${expectedLevel} approval level can perform this action.`)
    }

    if (stageAssignee) {
      if (!stageAssignee.isActive) {
        throw new HttpError(400, `Assigned ${APPROVAL_STAGE_META[currentStage].label.toLowerCase()} user must be active.`)
      }
      const assigneeLevels = parseApprovalLevels(stageAssignee.approvalLevel)
      if (!assigneeLevels.includes(expectedLevel)) {
        throw new HttpError(403, `Assigned approver must have ${expectedLevel} approval level.`)
      }
      if (actingUser.id !== stageAssignee.id) {
        throw new HttpError(403, `Only the assigned ${APPROVAL_STAGE_META[currentStage].label.toLowerCase()} may perform this action.`)
      }
    }

    stageAssignee = {
      ...(stageAssignee ?? {}),
      id: actingUser.id,
      name: actingUser.name,
      approvalLevel: actingUser.approvalLevel,
      isActive: actingUser.isActive,
      position: actingUser.position,
      eSignatureUrl: actingUser.eSignatureUrl,
      signatureParam: stageAssignee?.signatureParam ?? null,
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.case.update({ where: { id: caseData.id }, data: { status: nextStatus } })

    const isBackwardToEncoding =
      (ACTIVE_APPROVAL_STATUSES.has(currentStatus) && nextStatus === 'encoding') ||
      (currentStatus === 'rejected' && nextStatus === 'encoding')
    // A disapproval reopen (rejected -> encoding) always fully resets the trail — it's an
    // explicit "start over" signal with its own required reason. A soft "Return to
    // Encoding" kickback only preserves earlier-stage approvals when the person who sent
    // it back said this was a minor fix (preserveApprovals); otherwise it behaves exactly
    // as before.
    const shouldWipeApprovals = isBackwardToEncoding && !(preserveApprovals && currentStatus !== 'rejected')
    if (shouldWipeApprovals) {
      await tx.caseApproval.deleteMany({ where: { caseId: caseData.id } })
    }

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
          actedByTitle: stageAssignee.position ?? approvalActorTitle(currentStage),
          signatureUrlSnapshot: stageAssignee.eSignatureUrl,
          actedAt,
          action,
          notes: normalizedNotes,
        },
        update: {
          actedByUserId: stageAssignee.id,
          actedByName: stageAssignee.name,
          actedByTitle: stageAssignee.position ?? approvalActorTitle(currentStage),
          signatureUrlSnapshot: stageAssignee.eSignatureUrl,
          actedAt,
          action,
          notes: normalizedNotes,
        },
      })
    }

    const auditNotes = isResumeWithPreservedApprovals
      ? [normalizedNotes, `Resumed at the ${RESUME_STAGE_DESCRIPTION[nextStatus as keyof typeof RESUME_STAGE_DESCRIPTION] ?? nextStatus} stage — earlier-stage approvals were preserved from a prior "minor fix" kickback.`]
          .filter(Boolean)
          .join(' ')
      : isBackwardToEncoding && preserveApprovals && currentStatus !== 'rejected'
        ? [normalizedNotes, 'Returned as a minor fix — earlier-stage approvals preserved.'].filter(Boolean).join(' ')
        : normalizedNotes

    await auditLog(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      fromStatus: caseData.status,
      toStatus: nextStatus,
      notes: auditNotes,
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
