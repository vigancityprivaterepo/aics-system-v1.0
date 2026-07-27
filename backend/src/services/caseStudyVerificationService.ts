import { getApprovalSettings } from '../queries/caseQueries.js'
import { prisma } from '../utils/prisma.js'
import { resolveApprovalAssignees } from './approvalService.js'
import { serializeCase } from '../serializers/caseSerializer.js'
import {
  buildDocumentQrCodeBuffer,
  buildDocumentQrCodeDataUrl,
  buildDocumentVerificationUrl,
  createCaseStudyVerificationToken,
  verifyDocumentToken,
} from './documentVerification.js'

async function findActiveOfficialByPosition(positionNeedles: string[], approvalNeedle?: string): Promise<string | null> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { name: true, position: true, approvalLevel: true },
    orderBy: [{ name: 'asc' }],
  })

  const normalizedNeedles = positionNeedles.map((needle) => needle.toLowerCase())
  const official = users.find((user) => {
    const position = String(user.position ?? '').toLowerCase()
    const approvalLevel = String(user.approvalLevel ?? '').toLowerCase()
    return normalizedNeedles.some((needle) => position.includes(needle)) &&
      (!approvalNeedle || approvalLevel.includes(approvalNeedle))
  })

  return official?.name ?? null
}

async function resolveOfficialTemplateNames() {
  const [administrator, cswdo, cityMayor] = await Promise.all([
    findActiveOfficialByPosition(['city administrator', 'administrator'], 'reviewer'),
    findActiveOfficialByPosition(['city social welfare and development officer', 'social welfare and development'], 'recommender'),
    findActiveOfficialByPosition(['city mayor', 'mayor'], 'approver'),
  ])

  return { administrator, cswdo, cityMayor }
}
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
  const officialNames = await resolveOfficialTemplateNames()

  return {
    serialized: {
      ...serialized,
      documentQrCode: assets.qrCodeDataUrl,
      documentVerificationUrl: assets.verificationUrl,
      documentVerificationCode: assets.verificationCode,
      officialAdministratorName: officialNames.administrator,
      officialCswdoName: officialNames.cswdo,
      officialCityMayorName: officialNames.cityMayor,
    },
    assets,
  }
}

