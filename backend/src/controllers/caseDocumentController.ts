import type { Request, Response } from 'express'
import fs from 'node:fs/promises'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { currencyFromDb } from '../utils/currency.js'
import { findCaseWithDetails, getApprovalSettings } from '../queries/caseQueries.js'
import { serializeCase } from '../serializers/caseSerializer.js'
import { resolveApprovalAssignees } from '../services/approvalService.js'
import { assertReportAccess, paramId } from '../services/caseService.js'
import {
  generateBurialCaseStudyDocx,
  generateHospitalCaseStudyDocx,
  generateMedicineCaseStudyDocx,
  generateMedicalCaseStudyDocx,
  generateEyeglassCaseStudyDocx,
  generateEyeglassEndorsementDocx,
  generateEyeglassAcknowledgementDocx,
  generateMedicineAcknowledgementDocx,
  generatePlainCaseStudyDocx,
  generateChoCertificationDocx,
} from '../services/docxService.js'
import { generateCaseReportPdf } from '../services/pdfService.js'
import { buildConversionBasename, convertDocxBufferToHtml, convertDocxBufferToPdf } from '../services/officeConversionService.js'
import { buildCaseStudyVerificationAssets, buildRenderableCaseStudy } from '../services/caseStudyVerificationService.js'
import {
  generateGuaranteeLetterDocxForCase,
  generateGuaranteeLetterPdfForCase,
  loadGuaranteeLetterCase,
} from '../services/guaranteeLetterService.js'
import { activeReportSignatureStage, arePriorReportSignatureStagesSigned, previousReportSignatureStage } from '../services/reportSignatureService.js'
import { signedReportAbsolutePath } from '../services/storageService.js'

const CASE_STUDY_PDF_CACHE_TTL_MS = 60 * 60 * 1000
const MAX_CASE_STUDY_PDF_CACHE_ENTRIES = 64
const caseStudyPdfBufferCache = new Map<string, { version: string; buffer: Buffer; expiresAt: number }>()
const caseStudyPdfBufferInFlight = new Map<string, Promise<Buffer>>()

function sendDocx(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(buffer)
}

function sendPdf(res: Response, buffer: Buffer, filename: string) {
  if (!buffer?.length) {
    throw new HttpError(500, 'Generated PDF is empty.')
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(buffer)
}

function sendInlinePdf(res: Response, buffer: Buffer, filename: string) {
  if (!buffer?.length) {
    throw new HttpError(500, 'Generated PDF preview is empty.')
  }
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(buffer)
}

function extractSignedReportFilename(fileUrl: string | null | undefined) {
  const match = String(fileUrl ?? '').match(/\/uploads\/signed-reports\/([^/?#]+)$/i)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function pruneCaseStudyPdfBufferCache() {
  const now = Date.now()
  for (const [caseId, entry] of caseStudyPdfBufferCache.entries()) {
    if (entry.expiresAt <= now) {
      caseStudyPdfBufferCache.delete(caseId)
    }
  }

  while (caseStudyPdfBufferCache.size > MAX_CASE_STUDY_PDF_CACHE_ENTRIES) {
    const oldestKey = caseStudyPdfBufferCache.keys().next().value
    if (!oldestKey) break
    caseStudyPdfBufferCache.delete(oldestKey)
  }
}

function buildCaseStudyPdfCacheVersion(caseData: NonNullable<Awaited<ReturnType<typeof findCaseWithDetails>>>) {
  const extendedCaseData = caseData as any
  const reportSignatureState = (caseData.auditFlags as any)?.report_signature ?? null
  // Who signed each stage, and which signature image was captured for it, isn't reflected
  // in any of the fields above (a re-uploaded e-signature doesn't touch the case row at
  // all) - without this, a stale PDF with a missing/old signature would keep being served
  // from cache indefinitely once a stage had been acted on.
  const approvalsFingerprint = (extendedCaseData.approvals ?? []).map((approval: any) => ({
    stage: approval.stage,
    actedByName: approval.actedByName ?? null,
    actedByTitle: approval.actedByTitle ?? null,
    signatureUrlSnapshot: approval.signatureUrlSnapshot ?? null,
    // The report always renders the signer's CURRENT e-signature (see caseSerializer.ts),
    // not just the frozen snapshot, so a re-upload must bust this cache too.
    currentSignatureUrl: approval.actedByUser?.eSignatureUrl ?? null,
    actedAt: approval.actedAt?.toISOString?.() ?? String(approval.actedAt ?? ''),
  }))
  return JSON.stringify({
    layoutVersion: 18,
    id: caseData.id,
    status: caseData.status,
    assistanceType: caseData.assistanceType,
    updatedAt: caseData.updatedAt?.toISOString?.() ?? String(caseData.updatedAt ?? ''),
    caseNumber: caseData.caseNumber ?? caseData.client.caseNumber ?? '',
    dateOfAssessment: caseData.dateOfAssessment?.toISOString?.() ?? String(caseData.dateOfAssessment ?? ''),
    socialWorkerName: caseData.socialWorkerName ?? '',
    preparedBySignatureUrl: extendedCaseData.socialWorker?.eSignatureUrl ?? null,
    amount: currencyFromDb(caseData.amount),
    client: caseData.client ?? null,
    householdMembers: extendedCaseData.householdMembers ?? [],
    burialDetails: caseData.burialDetails ?? null,
    hospitalDetails: caseData.hospitalDetails ?? null,
    medicalDetails: caseData.medicalDetails ?? null,
    eyeglassDetails: caseData.eyeglassDetails ?? null,
    plainDetails: extendedCaseData.plainDetails ?? null,
    medicineDetails: extendedCaseData.medicineDetails ?? null,
    medicines: caseData.medicines ?? [],
    reportSignatureState,
    approvals: approvalsFingerprint,
  })
}

function getCachedCaseStudyPdfBuffer(caseId: string, version: string): Buffer | null {
  pruneCaseStudyPdfBufferCache()
  const entry = caseStudyPdfBufferCache.get(caseId)
  if (!entry) return null
  if (entry.version !== version || entry.expiresAt <= Date.now()) {
    caseStudyPdfBufferCache.delete(caseId)
    return null
  }

  caseStudyPdfBufferCache.delete(caseId)
  caseStudyPdfBufferCache.set(caseId, entry)
  return entry.buffer
}

function setCachedCaseStudyPdfBuffer(caseId: string, version: string, buffer: Buffer) {
  pruneCaseStudyPdfBufferCache()
  caseStudyPdfBufferCache.delete(caseId)
  caseStudyPdfBufferCache.set(caseId, {
    version,
    buffer,
    expiresAt: Date.now() + CASE_STUDY_PDF_CACHE_TTL_MS,
  })
  pruneCaseStudyPdfBufferCache()
}

async function loadSerializedCase(caseId: string, user: Express.AuthUser | undefined, scope: string) {
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(caseData, user, scope)
  const settings = await getApprovalSettings()
  const serialized = serializeCase(caseData, await resolveApprovalAssignees(settings))
  return { caseData, serialized }
}

type RenderableCaseStudy = Awaited<ReturnType<typeof buildRenderableCaseStudy>>

async function generateCaseStudyDocxBuffer(
  caseData: NonNullable<Awaited<ReturnType<typeof findCaseWithDetails>>>,
  renderableCaseStudy?: RenderableCaseStudy,
) {
  const { serialized } = renderableCaseStudy ?? await buildRenderableCaseStudy(caseData)

  if (caseData.assistanceType === 'burial') {
    return generateBurialCaseStudyDocx(serialized)
  }
  if (caseData.assistanceType === 'hospital') {
    return generateHospitalCaseStudyDocx(serialized, (caseData.hospitalDetails?.templateType ?? 'personal') as 'personal' | 'proxy')
  }
  if (caseData.assistanceType === 'medicine') {
    return generateMedicineCaseStudyDocx(serialized, (serialized.medicineDetails?.templateType ?? 'personal') as 'personal' | 'proxy')
  }
  if (caseData.assistanceType === 'medical') {
    return generateMedicalCaseStudyDocx(serialized, (caseData.medicalDetails?.templateType ?? 'personal') as 'personal' | 'proxy')
  }
  if (caseData.assistanceType === 'eyeglass') {
    return generateEyeglassCaseStudyDocx(serialized, (serialized.eyeglassDetails?.templateType ?? 'personal') as 'personal' | 'proxy')
  }
  if (caseData.assistanceType === 'plain') {
    return generatePlainCaseStudyDocx(serialized)
  }

  throw new HttpError(400, 'Word document report is not available for this assistance type')
}

export async function generateCaseStudyPdfBuffer(caseData: NonNullable<Awaited<ReturnType<typeof findCaseWithDetails>>>) {
  const renderableCaseStudy = await buildRenderableCaseStudy(caseData)

  try {
    const docxBuffer = await generateCaseStudyDocxBuffer(caseData, renderableCaseStudy)
    const caseNumber = caseData.caseNumber ?? caseData.client.caseNumber
    const convertedPdf = await convertDocxBufferToPdf(docxBuffer, buildConversionBasename(`${caseNumber}-case-study`))
    if (convertedPdf?.length) return convertedPdf
    if (convertedPdf && !convertedPdf.length) {
      console.warn('[CaseStudy PDF Conversion] LibreOffice returned an empty PDF. Falling back to PDFKit output.')
    }
  } catch (error) {
    console.warn('[CaseStudy PDF Conversion] DOCX-based conversion unavailable, using PDFKit fallback.', error)
  }

  const { serialized, assets } = renderableCaseStudy

  return generateCaseReportPdf({
    caseNumber: caseData.caseNumber ?? caseData.client.caseNumber,
    assistanceType: caseData.assistanceType,
    clientName: `${caseData.client.lastName}, ${caseData.client.firstName}`,
    dateOfAssessment: caseData.dateOfAssessment?.toISOString().slice(0, 10) ?? null,
    socialWorkerName: caseData.socialWorkerName,
    presentingProblem: caseData.presentingProblem,
    backgroundOfProblem: caseData.backgroundOfProblem,
    assessment: caseData.assessment,
    recommendation: caseData.recommendation,
    remarks: caseData.remarks,
    amount: currencyFromDb(caseData.amount),
    verificationUrl: assets.verificationUrl,
    verificationCode: assets.verificationCode,
    qrCodeImage: assets.qrCodeImage,
    renderableCase: serialized,
  })
}

async function getOrGenerateCaseStudyPdfBuffer(caseData: NonNullable<Awaited<ReturnType<typeof findCaseWithDetails>>>) {
  const caseId = String(caseData.id)
  const version = buildCaseStudyPdfCacheVersion(caseData)
  const cached = getCachedCaseStudyPdfBuffer(caseId, version)
  if (cached) return cached

  const inFlightKey = `${caseId}:${version}`
  const existingTask = caseStudyPdfBufferInFlight.get(inFlightKey)
  if (existingTask) {
    return existingTask
  }

  const task = generateCaseStudyPdfBuffer(caseData)
    .then((buffer) => {
      setCachedCaseStudyPdfBuffer(caseId, version, buffer)
      return buffer
    })
    .finally(() => {
      caseStudyPdfBufferInFlight.delete(inFlightKey)
    })

  caseStudyPdfBufferInFlight.set(inFlightKey, task)
  return task
}

export async function caseStudyDocx(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(caseData, req.user, 'docx report')

  const buffer = await generateCaseStudyDocxBuffer(caseData)
  const baseFilename = `${caseData.caseNumber ?? caseData.client.caseNumber}-case-study.docx`
  sendDocx(res, buffer, baseFilename)
}

export async function caseStudyHtml(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(caseData, req.user, 'case study preview')

  const docxBuffer = await generateCaseStudyDocxBuffer(caseData)
  const caseNumber = caseData.caseNumber ?? caseData.client.caseNumber
  const html = await convertDocxBufferToHtml(docxBuffer, buildConversionBasename(`${caseNumber}-case-study`))
  if (!html) throw new HttpError(503, 'LibreOffice HTML preview is not available.')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(html)
}
export async function caseStudyPdf(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const detailedCaseData = await findCaseWithDetails(caseId)
  if (!detailedCaseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(detailedCaseData, req.user, 'case study report')
  const buffer = await getOrGenerateCaseStudyPdfBuffer(detailedCaseData)
  sendPdf(res, buffer, `${detailedCaseData.caseNumber ?? detailedCaseData.client.caseNumber}-case-study.pdf`)
}

export async function caseStudyPreviewPdf(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(caseData, req.user, 'case study preview pdf')

  const reportSignatureState = (caseData.auditFlags as any)?.report_signature
  const latestSignedFileUrl =
    reportSignatureState?.stages?.for_approval?.status === 'signed' ? reportSignatureState?.stages?.for_approval?.signedFileUrl
    : reportSignatureState?.stages?.recommending_approval?.status === 'signed' ? reportSignatureState?.stages?.recommending_approval?.signedFileUrl
    : reportSignatureState?.stages?.for_review?.status === 'signed' ? reportSignatureState?.stages?.for_review?.signedFileUrl
    : reportSignatureState?.stages?.prepared_by?.status === 'signed' ? reportSignatureState?.stages?.prepared_by?.signedFileUrl
    : null

  const generatedDraftRequested = String(req.query.source ?? '').toLowerCase() === 'generated'

  if (latestSignedFileUrl && !generatedDraftRequested) {
    const filename = extractSignedReportFilename(latestSignedFileUrl)
    if (filename) {
      const buffer = await fs.readFile(signedReportAbsolutePath(filename))
      if (buffer.length > 0) {
        return sendInlinePdf(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-case-study-preview.pdf`)
      }
      console.warn('[CaseStudy Preview PDF] Latest signed PDF was empty. Falling back to generated PDF preview.', {
        caseId,
        filename,
      })
    }
  }

  const buffer = await getOrGenerateCaseStudyPdfBuffer(caseData)
  sendInlinePdf(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-case-study-preview.pdf`)
}

export async function currentCaseStudySigningPdf(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(caseData, req.user, 'current case study signing pdf')

  const activeStage = activeReportSignatureStage(caseData.status)
  if (!activeStage) throw new HttpError(400, 'No active signing stage for this case.')
  if (!arePriorReportSignatureStagesSigned(caseData.auditFlags, activeStage)) {
    throw new HttpError(400, 'The latest signed case study PDF is not available yet for this signer.')
  }

  if (activeStage === 'prepared_by') {
    const buffer = await getOrGenerateCaseStudyPdfBuffer(caseData)
    return sendPdf(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-case-study.pdf`)
  }

  const previousStage = previousReportSignatureStage(activeStage)
  const reportSignatureState = (caseData.auditFlags as any)?.report_signature
  const previousStageFileUrl = previousStage ? reportSignatureState?.stages?.[previousStage]?.signedFileUrl : null
  const filename = extractSignedReportFilename(previousStageFileUrl)
  if (!filename) {
    throw new HttpError(404, 'The latest signed case study PDF is not available yet.')
  }

  const buffer = await fs.readFile(signedReportAbsolutePath(filename))
  if (!buffer.length) {
    throw new HttpError(500, 'The latest signed case study PDF is empty.')
  }
  sendPdf(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-case-study.pdf`)
}

export async function guaranteeLetterPdf(req: Request, res: Response) {
  const caseData = await loadGuaranteeLetterCase(paramId(req.params.id))
  assertReportAccess(caseData, req.user, 'guarantee letter')
  const buffer = await generateGuaranteeLetterPdfForCase(caseData)

  sendPdf(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-guarantee-letter.pdf`)
}

export async function guaranteeLetterDocx(req: Request, res: Response) {
  const caseData = await loadGuaranteeLetterCase(paramId(req.params.id))
  assertReportAccess(caseData, req.user, 'guarantee letter docx')
  const filename = `${caseData.caseNumber ?? caseData.client.caseNumber}-guarantee-letter.docx`
  if (caseData.assistanceType === 'eyeglass') throw new HttpError(400, 'Use /report/endorsement-docx for eyeglass cases')
  const buffer = await generateGuaranteeLetterDocxForCase(caseData)
  sendDocx(res, buffer, filename)
}

export async function endorsementDocx(req: Request, res: Response) {
  const { caseData, serialized } = await loadSerializedCase(paramId(req.params.id), req.user, 'endorsement docx')
  if (caseData.assistanceType !== 'eyeglass') throw new HttpError(400, 'Endorsement is only available for eyeglass cases')
  const buffer = await generateEyeglassEndorsementDocx(serialized)
  sendDocx(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-endorsement.docx`)
}

export async function acknowledgementDocx(req: Request, res: Response) {
  const { caseData, serialized } = await loadSerializedCase(paramId(req.params.id), req.user, 'acknowledgement docx')
  if (caseData.assistanceType !== 'eyeglass' && caseData.assistanceType !== 'medicine') {
    throw new HttpError(400, 'Acknowledgement is only available for eyeglass and medicine cases')
  }
  const buffer = caseData.assistanceType === 'medicine'
    ? await generateMedicineAcknowledgementDocx(serialized)
    : await generateEyeglassAcknowledgementDocx(serialized)
  sendDocx(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-acknowledgement.docx`)
}

export async function choCertificationDocx(req: Request, res: Response) {
  const { caseData, serialized } = await loadSerializedCase(paramId(req.params.id), req.user, 'cho certification docx')
  if (caseData.assistanceType !== 'medicine') throw new HttpError(400, 'CHO Certification is only available for medicine cases')
  const buffer = await generateChoCertificationDocx(serialized)
  if (!buffer) {
    throw new HttpError(400, 'All encoded medicines in this case are available in the regular CHO procurement. Certification remains blank.')
  }
  sendDocx(res, buffer, `${caseData.caseNumber ?? caseData.client.caseNumber}-cho-certification.docx`)
}
