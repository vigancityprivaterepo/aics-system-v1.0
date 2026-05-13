import { getApprovalSettings } from '../queries/caseQueries.js'
import { resolveApprovalAssignees } from './approvalService.js'
import { serializeCase } from '../serializers/caseSerializer.js'
import {
  buildDocumentQrCodeBuffer,
  buildDocumentQrCodeDataUrl,
  buildDocumentVerificationUrl,
  createCaseStudyVerificationToken,
  verifyDocumentToken,
} from './documentVerification.js'

export async function buildCaseStudyVerificationAssets(caseData: any) {
  const caseNumber = caseData.caseNumber ?? caseData.client.caseNumber
  const token = createCaseStudyVerificationToken({
    caseId: caseData.id,
    caseNumber,
    assistanceType: caseData.assistanceType,
  })
  const verificationUrl = buildDocumentVerificationUrl(token)
  const qrCodeImage = await buildDocumentQrCodeBuffer(token)
  const qrCodeDataUrl = await buildDocumentQrCodeDataUrl(token)
  const { verificationCode } = verifyDocumentToken(token)

  return {
    token,
    verificationUrl,
    qrCodeImage,
    qrCodeDataUrl,
    verificationCode,
  }
}

export async function buildRenderableCaseStudy(caseData: any) {
  const settings = await getApprovalSettings()
  const serialized = serializeCase(caseData, await resolveApprovalAssignees(settings))
  const assets = await buildCaseStudyVerificationAssets(caseData)

  return {
    serialized: {
      ...serialized,
      documentQrCode: assets.qrCodeDataUrl,
      documentVerificationUrl: assets.verificationUrl,
      documentVerificationCode: assets.verificationCode,
    },
    assets,
  }
}
