import type { Request, Response } from 'express'
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

function sendDocx(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(buffer)
}

function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(buffer)
}

async function loadSerializedCase(caseId: string, user: Express.AuthUser | undefined, scope: string) {
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertReportAccess(caseData, user, scope)
  const settings = await getApprovalSettings()
  const serialized = serializeCase(caseData, await resolveApprovalAssignees(settings))
  return { caseData, serialized }
}

async function generateCaseStudyDocxBuffer(caseData: NonNullable<Awaited<ReturnType<typeof findCaseWithDetails>>>) {
  const { serialized } = await buildRenderableCaseStudy(caseData)

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

  try {
    const docxBuffer = await generateCaseStudyDocxBuffer(detailedCaseData)
    const caseNumber = detailedCaseData.caseNumber ?? detailedCaseData.client.caseNumber
    const convertedPdf = await convertDocxBufferToPdf(docxBuffer, buildConversionBasename(`${caseNumber}-case-study`))
    if (convertedPdf) {
      return sendPdf(res, convertedPdf, `${caseNumber}-case-study.pdf`)
    }
  } catch (error) {
    console.warn('[CaseStudy PDF Conversion] DOCX-based conversion unavailable, using PDFKit fallback.', error)
  }

  const caseData = detailedCaseData
  const verificationAssets = await buildCaseStudyVerificationAssets(caseData)

  const buffer = await generateCaseReportPdf({
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
    verificationUrl: verificationAssets.verificationUrl,
    verificationCode: verificationAssets.verificationCode,
    qrCodeImage: verificationAssets.qrCodeImage,
  })

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
  if (caseData.assistanceType !== 'eyeglass') throw new HttpError(400, 'Acknowledgement is only available for eyeglass cases')
  const buffer = await generateEyeglassAcknowledgementDocx(serialized)
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
