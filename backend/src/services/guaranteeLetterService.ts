import { currencyFromDb } from '../utils/currency.js'
import { HttpError } from '../utils/httpError.js'
import { findCaseWithDetails, getApprovalSettings } from '../queries/caseQueries.js'
import { resolveApprovalAssignees } from './approvalService.js'
import { serializeCase } from '../serializers/caseSerializer.js'
import {
  generateGuaranteeLetterDocx,
  generateHospitalGuaranteeLetterDocx,
  generateMedicalGuaranteeLetterDocx,
} from './docxService.js'
import { generateGuaranteeLetterPdf } from './pdfService.js'
import {
  buildGuaranteeLetterQrCodeBuffer,
  buildGuaranteeLetterQrCodeDataUrl,
  buildGuaranteeLetterVerificationUrl,
  createGuaranteeLetterVerificationToken,
  verifyGuaranteeLetterToken,
} from './documentVerification.js'
import { buildConversionBasename, convertDocxBufferToPdf } from './officeConversionService.js'

function fullNameOfClient(client: { firstName: string; middleName?: string | null; lastName: string }) {
  return [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' ')
}

function formatDate(value: Date | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function formatDateOrNull(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

function titleCaseLabel(input: string) {
  return input
    .split('_')
    .join(' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function buildLetterBody(caseData: Awaited<ReturnType<typeof findCaseWithDetails>> extends infer T ? NonNullable<T> : never) {
  const clientName = fullNameOfClient(caseData.client)
  const amount = currencyFromDb(caseData.amount)
  const base = {
    caseNumber: caseData.caseNumber ?? caseData.client.caseNumber,
    assistanceType: titleCaseLabel(caseData.assistanceType),
    clientName,
    amount,
    date: formatDate(caseData.updatedAt),
    socialWorkerName: caseData.socialWorkerName ?? null,
  }

  if (caseData.assistanceType === 'burial') {
    return {
      ...base,
      beneficiaryName: caseData.burialDetails?.deceasedName ?? clientName,
      proxyName: clientName,
      proxyRelationship: caseData.burialDetails?.conformeRelationship ?? null,
      recipientName: caseData.burialDetails?.funeralHome ?? null,
      recipientAddress: caseData.burialDetails?.funeralOwnerAddress ?? null,
      lineItems: [
        { label: 'Type of Bill', value: caseData.burialDetails?.typeOfBill ?? null },
        { label: 'Cause of Death', value: caseData.burialDetails?.causeOfDeath ?? null },
      ],
    }
  }

  if (caseData.assistanceType === 'hospital') {
    return {
      ...base,
      beneficiaryName: caseData.hospitalDetails?.patientName ?? clientName,
      proxyName: caseData.hospitalDetails?.conformeName ?? clientName,
      proxyRelationship: caseData.hospitalDetails?.conformeRelationship ?? 'Self',
      recipientName: caseData.hospitalDetails?.hospitalName ?? caseData.hospitalClinic ?? null,
      recipientAddress: caseData.hospitalDetails?.hospitalAddress ?? null,
      diagnosis: caseData.hospitalDetails?.diagnosis ?? null,
      lineItems: [
        { label: 'Admission Date', value: formatDateOrNull(caseData.hospitalDetails?.admissionDate) },
        { label: 'Type of Bill', value: caseData.hospitalDetails?.typeOfBill ?? null },
        { label: 'Attending Physician', value: caseData.hospitalDetails?.doctorName ?? null },
      ],
    }
  }

  if (caseData.assistanceType === 'medical') {
    return {
      ...base,
      beneficiaryName: clientName,
      proxyName: caseData.medicalDetails?.conformeName ?? clientName,
      proxyRelationship: caseData.medicalDetails?.conformeRelationship ?? 'Self',
      recipientName: caseData.medicalDetails?.clinicName ?? caseData.hospitalClinic ?? null,
      recipientAddress: caseData.medicalDetails?.clinicAddress ?? null,
      diagnosis: caseData.medicalDetails?.diagnosis ?? null,
      medicalType: caseData.medicalDetails?.medicalType ?? null,
      lineItems: [
        { label: 'Consultation Date', value: formatDateOrNull(caseData.medicalDetails?.consultationDate) },
        { label: 'Operation Type', value: caseData.medicalDetails?.operationType ?? null },
        { label: 'Attending Physician', value: caseData.medicalDetails?.doctorName ?? null },
      ],
    }
  }

  throw new HttpError(400, 'Guarantee letter is not available for this assistance type')
}

export async function loadGuaranteeLetterCase(caseId: string) {
  const caseData = await findCaseWithDetails(caseId)
  if (!caseData) throw new HttpError(404, 'Case not found')
  return caseData
}

export async function buildGuaranteeLetterAssets(caseData: Awaited<ReturnType<typeof loadGuaranteeLetterCase>>) {
  const caseNumber = caseData.caseNumber ?? caseData.client.caseNumber
  const token = createGuaranteeLetterVerificationToken({
    caseId: caseData.id,
    caseNumber,
    assistanceType: caseData.assistanceType,
  })
  const verificationUrl = buildGuaranteeLetterVerificationUrl(token)
  const qrCodeImage = await buildGuaranteeLetterQrCodeBuffer(token)
  const qrCodeDataUrl = await buildGuaranteeLetterQrCodeDataUrl(token)
  const { verificationCode } = verifyGuaranteeLetterToken(token)

  return {
    token,
    verificationUrl,
    qrCodeImage,
    qrCodeDataUrl,
    verificationCode,
  }
}

export async function generateGuaranteeLetterPdfForCase(caseData: Awaited<ReturnType<typeof loadGuaranteeLetterCase>>) {
  const assets = await buildGuaranteeLetterAssets(caseData)
  return generateGuaranteeLetterPdfForCaseWithAssets(caseData, assets)
}

export async function generateGuaranteeLetterPdfForCaseWithAssets(
  caseData: Awaited<ReturnType<typeof loadGuaranteeLetterCase>>,
  assets: Awaited<ReturnType<typeof buildGuaranteeLetterAssets>>,
) {
  try {
    const docxBuffer = await generateGuaranteeLetterDocxForCaseWithAssets(caseData, assets)
    const caseNumber = caseData.caseNumber ?? caseData.client.caseNumber
    const convertedPdf = await convertDocxBufferToPdf(docxBuffer, buildConversionBasename(`${caseNumber}-guarantee-letter`))
    if (convertedPdf) return convertedPdf
  } catch (error) {
    console.warn('[GuaranteeLetter PDF Conversion] DOCX-based conversion unavailable, using PDFKit fallback.', error)
  }

  return generateGuaranteeLetterPdf({
    ...buildLetterBody(caseData),
    verificationUrl: assets.verificationUrl,
    verificationCode: assets.verificationCode,
    qrCodeImage: assets.qrCodeImage,
  })
}

export async function generateGuaranteeLetterDocxForCase(caseData: Awaited<ReturnType<typeof loadGuaranteeLetterCase>>) {
  const assets = await buildGuaranteeLetterAssets(caseData)
  return generateGuaranteeLetterDocxForCaseWithAssets(caseData, assets)
}

export async function generateGuaranteeLetterDocxForCaseWithAssets(
  caseData: Awaited<ReturnType<typeof loadGuaranteeLetterCase>>,
  assets: Awaited<ReturnType<typeof buildGuaranteeLetterAssets>>,
) {
  const settings = await getApprovalSettings()
  const serialized = serializeCase(caseData, await resolveApprovalAssignees(settings))
  const renderable = {
    ...serialized,
    documentQrCode: assets.qrCodeDataUrl,
    documentVerificationUrl: assets.verificationUrl,
    documentVerificationCode: assets.verificationCode,
  }

  if (caseData.assistanceType === 'burial') {
    return generateGuaranteeLetterDocx(renderable)
  }
  if (caseData.assistanceType === 'hospital') {
    return generateHospitalGuaranteeLetterDocx(renderable)
  }
  if (caseData.assistanceType === 'medical') {
    return generateMedicalGuaranteeLetterDocx(renderable)
  }

  throw new HttpError(400, 'Guarantee letter is not available for this assistance type')
}
