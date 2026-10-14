import type { Request, Response } from 'express'
import fs from 'node:fs/promises'
import { ApplicantApplicationStatus, Prisma, type ApprovalAction, type CaseStatus } from '@prisma/client'
import { findCaseWithDetails, getApprovalSettings } from '../queries/caseQueries.js'
import { serializeCase } from '../serializers/caseSerializer.js'
import { approvalActorTitle, resolveApprovalAssignees } from '../services/approvalService.js'
import {
  activeReportSignatureStage,
  applySignedReportStage,
  createFreshReportSignatureState,
  extractRawReportSignatureState,
  mergeReportSignatureIntoAuditFlags,
  previousReportSignatureStage,
  replaceSignedReportStage,
  userCanUploadReportSignatureStage,
} from '../services/reportSignatureService.js'
import { assertEditableCase, assertReportAccess, paramId } from '../services/caseService.js'
import { HttpError } from '../utils/httpError.js'
import { prisma } from '../utils/prisma.js'
import { signedReportPublicUrl } from '../services/storageService.js'
import { APPROVAL_STAGE_META } from '../types/caseTypes.js'
import { auditLog } from '../utils/auditLog.js'
import { sendPortalStatusNotifications } from '../services/portalStatusNotifications.js'

function userCanManageCaseSigning(caseData: { socialWorkerId: string | null }, user: Express.AuthUser | undefined) {
  if (!user) return false
  if (user.role === 'admin') return true
  if (caseData.socialWorkerId && caseData.socialWorkerId === user.id) return true
  return ['reviewer', 'recommender', 'approver'].some((level) => user.approvalLevel.includes(level))
}

async function rejectUploadedFile(file: Express.Multer.File, message: string): Promise<never> {
  await fs.rm(file.path, { force: true }).catch(() => {})
  throw new HttpError(400, message)
}

async function assertUploadedSignedPdf(file: Express.Multer.File) {
  const extension = String(file.originalname ?? '').toLowerCase()
  if (!extension.endsWith('.pdf')) {
    await rejectUploadedFile(file, 'Only signed PDF files are allowed')
  }

  try {
    const handle = await fs.open(file.path, 'r')
    try {
      const header = Buffer.alloc(1024)
      const { bytesRead } = await handle.read(header, 0, header.length, 0)
      if (!header.subarray(0, bytesRead).includes(Buffer.from('%PDF-'))) {
        await rejectUploadedFile(file, 'The selected file is not a valid PDF document.')
      }
    } finally {
      await handle.close()
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    await rejectUploadedFile(file, 'The uploaded PDF could not be read.')
  }
}

function reportSignaturePayloadForUser(serialized: any, caseData: any, user: Express.AuthUser | undefined) {
  const reportSignature = serialized.reportSignature
  if (!reportSignature) return null
  const activeStage = reportSignature.activeStageKey
    ? reportSignature.stages.find((stage: any) => stage.key === reportSignature.activeStageKey) ?? null
    : null
  const canPrepare =
    ['intake', 'encoding', 'requirements', 'for_review', 'recommending_approval', 'for_approval'].includes(String(caseData.status ?? '')) &&
    userCanManageCaseSigning(caseData, user)
  const canUploadCurrentStage = userCanUploadReportSignatureStage(user, activeStage, caseData) &&
    reportSignature.readyForCurrentStageSigning
  const latestSignedStage = [...reportSignature.stages].reverse().find((stage: any) => stage.status === 'signed') ?? null
  const canReplaceLatestStage = !!latestSignedStage && !!user && (
    user.role === 'admin' ||
    latestSignedStage.signedByUserId === user.id ||
    latestSignedStage.assignedUserId === user.id
  )

  return {
    ...reportSignature,
    canPrepare,
    canUploadCurrentStage,
    currentStageAssignedToCurrentUser: !!activeStage && activeStage.assignedUserId === user?.id,
    replaceableStage: canReplaceLatestStage
      ? {
          key: latestSignedStage.key,
          label: latestSignedStage.label,
          signedAt: latestSignedStage.signedAt,
          replacementCount: latestSignedStage.replacementCount ?? 0,
        }
      : null,
  }
}

async function buildCaseResponse(caseId: string, user: Express.AuthUser | undefined) {
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(caseData, user, 'case study signature')
  const settings = await getApprovalSettings()
  const assigneesByStage = await resolveApprovalAssignees(settings)
  const serialized = serializeCase(caseData, assigneesByStage)
  return {
    caseData,
    assigneesByStage,
    reportSignature: reportSignaturePayloadForUser(serialized, caseData, user),
  }
}

function nextStatusAfterSignedUpload(currentStatus: CaseStatus | string): CaseStatus | null {
  if (currentStatus === 'intake' || currentStatus === 'encoding' || currentStatus === 'requirements') return 'for_review'
  if (currentStatus === 'for_review') return 'recommending_approval'
  if (currentStatus === 'recommending_approval') return 'for_approval'
  if (currentStatus === 'for_approval') return 'approved'
  return null
}

export async function prepareCaseStudySignature(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const existing = await findCaseWithDetails(caseId)
  if (!existing) throw new HttpError(404, 'Case not found')
  assertEditableCase(existing, req.user, 'Case study signature preparation')

  const activeStage = activeReportSignatureStage(existing.status)
  if (!activeStage) throw new HttpError(400, `Case study signature is not available when case is ${existing.status}.`)

  const settings = await getApprovalSettings()
  const assigneesByStage = await resolveApprovalAssignees(settings)
  const nextReportSignature = createFreshReportSignatureState(existing, assigneesByStage)

  await prisma.case.update({
    where: { id: caseId },
    data: {
      auditFlags: mergeReportSignatureIntoAuditFlags(existing.auditFlags, nextReportSignature) as Prisma.InputJsonValue,
    },
  })

  const { reportSignature } = await buildCaseResponse(caseId, req.user)
  res.json({ reportSignature })
}

export async function uploadCaseStudySignedReport(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const file = req.file
  if (!file) throw new HttpError(400, 'No signed PDF uploaded')
  await assertUploadedSignedPdf(file)

  const { caseData, assigneesByStage } = await buildCaseResponse(caseId, req.user)
  const currentStage = activeReportSignatureStage(caseData.status)
  if (!currentStage) throw new HttpError(400, `Case study signature is not available when case is ${caseData.status}.`)

  const currentSignature = serializeCase(caseData, assigneesByStage).reportSignature
  if (!currentSignature) throw new HttpError(400, 'Case study signature is not available for this case.')
  if (!currentSignature.readyForCurrentStageSigning) {
    const previousStageKey = previousReportSignatureStage(currentStage)
    throw new HttpError(400, previousStageKey ? 'Previous signature stage must be completed first.' : 'This signature stage is not ready yet.')
  }

  const activeStageInfo = currentSignature.stages.find((stage: any) => stage.key === currentStage)
  if (!activeStageInfo) throw new HttpError(400, 'Active signature stage was not found.')
  if (!userCanUploadReportSignatureStage(req.user, activeStageInfo, caseData)) {
    throw new HttpError(403, 'Only the assigned signer can upload the signed case study report for this stage.')
  }

  const signedFileUrl = signedReportPublicUrl(file.filename)
  const currentRaw =
    currentStage === 'prepared_by'
      ? createFreshReportSignatureState(caseData, assigneesByStage)
      : extractRawReportSignatureState(caseData.auditFlags)
  if (!currentRaw?.version) {
    throw new HttpError(400, 'The previous signing stage must be uploaded first.')
  }

  const updatedState = applySignedReportStage(currentRaw as any, currentStage, {
    signedFileUrl,
    signedByUserId: req.user?.id ?? null,
    signedByName: req.user?.name ?? null,
  })

  const nextStatus = nextStatusAfterSignedUpload(caseData.status)

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseId },
      data: {
        auditFlags: mergeReportSignatureIntoAuditFlags(caseData.auditFlags, updatedState) as Prisma.InputJsonValue,
        ...(nextStatus ? { status: nextStatus } : {}),
      },
    })

    if (currentStage !== 'prepared_by') {
      const action: ApprovalAction = 'approved'
      const actedAt = new Date()
      await tx.caseApproval.upsert({
        where: { caseId_stage: { caseId, stage: currentStage } },
        create: {
          caseId,
          stage: currentStage,
          actedByUserId: req.user?.id ?? null,
          actedByName: req.user?.name ?? 'Unknown User',
          actedByTitle: req.user?.position ?? approvalActorTitle(currentStage),
          signatureUrlSnapshot: null,
          actedAt,
          action,
          notes: 'Automatically forwarded after signed PDF upload.',
        },
        update: {
          actedByUserId: req.user?.id ?? null,
          actedByName: req.user?.name ?? 'Unknown User',
          actedByTitle: req.user?.position ?? approvalActorTitle(currentStage),
          signatureUrlSnapshot: null,
          actedAt,
          action,
          notes: 'Automatically forwarded after signed PDF upload.',
        },
      })
    }

    if (nextStatus) {
      await auditLog(tx, {
        caseId,
        changedById: req.user?.id,
        fromStatus: caseData.status,
        toStatus: nextStatus,
        notes:
          currentStage === 'prepared_by'
            ? 'Automatically submitted for review after signed PDF upload.'
            : `Automatically forwarded to ${APPROVAL_STAGE_META[currentStage].nextStatus.replace(/_/g, ' ')} after signed PDF upload.`,
      })
    }

    if (nextStatus === 'approved') {
      await tx.applicantApplication.updateMany({
        where: { caseId },
        data: {
          status: ApplicantApplicationStatus.approved,
          reviewedAt: new Date(),
          adminNotes: 'Automatically approved after final signed case study PDF upload.',
        },
      })
    }
  })

  const { reportSignature } = await buildCaseResponse(caseId, req.user)
  if (nextStatus && ['for_review', 'recommending_approval', 'for_approval', 'approved'].includes(nextStatus)) {
    const linkedApplication = await prisma.applicantApplication.findFirst({
      where: { caseId },
      include: { applicant: { select: { firstName: true, email: true, mobileNumber: true } } },
    })
    if (linkedApplication) {
      sendPortalStatusNotifications({ ...linkedApplication, status: nextStatus, adminNotes: null }).catch(console.error)
    }
  }
  res.json({ reportSignature })
}

export async function replaceCaseStudySignedReport(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const file = req.file
  if (!file) throw new HttpError(400, 'No replacement signed PDF uploaded')
  await assertUploadedSignedPdf(file)

  const { caseData, assigneesByStage } = await buildCaseResponse(caseId, req.user)
  const currentSignature = serializeCase(caseData, assigneesByStage).reportSignature
  if (!currentSignature) throw new HttpError(400, 'Case study signature is not available for this case.')

  const latestSignedStage = [...currentSignature.stages].reverse().find((stage: any) => stage.status === 'signed')
  if (!latestSignedStage) throw new HttpError(400, 'There is no signed PDF to replace.')

  const requestedStageKey = String(req.body?.stageKey ?? '')
  if (requestedStageKey !== latestSignedStage.key) {
    throw new HttpError(409, 'Only the latest signed PDF can be replaced. Refresh the case and try again.')
  }

  const canReplace = !!req.user && (
    req.user.role === 'admin' ||
    latestSignedStage.signedByUserId === req.user.id ||
    latestSignedStage.assignedUserId === req.user.id
  )
  if (!canReplace) {
    throw new HttpError(403, 'Only the signer who uploaded the latest PDF or an administrator can replace it.')
  }

  const currentRaw = extractRawReportSignatureState(caseData.auditFlags)
  if (!currentRaw?.version) throw new HttpError(400, 'Case study signature state was not found.')

  const reason = String(req.body?.reason ?? 'Incorrect signed PDF was uploaded.').trim().slice(0, 250)
  const replacementFileUrl = signedReportPublicUrl(file.filename)
  const updatedState = replaceSignedReportStage(currentRaw as any, latestSignedStage.key, {
    signedFileUrl: replacementFileUrl,
    replacedByUserId: req.user?.id ?? null,
    replacedByName: req.user?.name ?? null,
    reason: reason || null,
  })

  await prisma.$transaction(async (tx) => {
    const updateResult = await tx.case.updateMany({
      where: { id: caseId, updatedAt: caseData.updatedAt },
      data: {
        auditFlags: mergeReportSignatureIntoAuditFlags(caseData.auditFlags, updatedState) as Prisma.InputJsonValue,
      },
    })
    if (updateResult.count !== 1) {
      throw new HttpError(409, 'A newer signature was uploaded before this replacement. Refresh the case before trying again.')
    }
    await auditLog(tx, {
      caseId,
      changedById: req.user?.id,
      fromStatus: caseData.status,
      toStatus: caseData.status,
      notes: `Replaced the ${latestSignedStage.label} signed PDF. Previous upload retained in signature history.${reason ? ` Reason: ${reason}` : ''}`,
    })
  })

  const { reportSignature } = await buildCaseResponse(caseId, req.user)
  res.json({ reportSignature })
}
