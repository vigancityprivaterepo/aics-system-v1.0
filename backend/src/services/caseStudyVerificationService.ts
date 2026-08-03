import { getApprovalSettings } from '../queries/caseQueries.js'
import { prisma } from '../utils/prisma.js'
import { resolveApprovalAssignees } from './approvalService.js'
import { serializeCase } from '../serializers/caseSerializer.js'
import {
  buildDocumentQrCodeBuffer,
  buildDocumentVerificationUrl,
  createCaseStudyVerificationToken,
  verifyDocumentToken,
} from './documentVerification.js'

type OfficialProfile = {
  name: string | null
  position: string | null
}

async function findActiveOfficialProfile(
  positionNeedles: string[],
  options: { approvalNeedle?: string; role?: 'employee' | 'admin' | 'city_health_office' } = {},
): Promise<OfficialProfile> {
  const users = await prisma.user.findMany({
    where: { isActive: true, ...(options.role ? { role: options.role } : {}) },
    select: { name: true, position: true, approvalLevel: true, role: true },
    orderBy: [{ name: 'asc' }],
  })

  const normalizedNeedles = positionNeedles.map((needle) => needle.toLowerCase())
  const official = users.find((user) => {
    const position = String(user.position ?? '').toLowerCase()
    const approvalLevel = String(user.approvalLevel ?? '').toLowerCase()
    return normalizedNeedles.some((needle) => position.includes(needle)) &&
      (!options.approvalNeedle || approvalLevel.includes(options.approvalNeedle))
  })

  if (official) {
    return {
      name: official.name ?? null,
      position: official.position ?? null,
    }
  }

  if (options.role === 'city_health_office' && users.length > 0) {
    const fallback = users.find((user) => String(user.position ?? '').trim().length > 0) ?? users[0]
    return {
      name: fallback?.name ?? null,
      position: fallback?.position ?? null,
    }
  }

  return { name: null, position: null }
}

async function findActiveOfficialByPosition(positionNeedles: string[], approvalNeedle?: string): Promise<string | null> {
  const official = await findActiveOfficialProfile(positionNeedles, { approvalNeedle })
  return official.name
}

export async function resolveActiveSignatureUsers() {
  const users = await prisma.user.findMany({
    where: { isActive: true, signatureParam: { not: null } },
    select: { name: true, position: true, signatureParam: true, eSignatureUrl: true },
    orderBy: [{ name: 'asc' }],
  })

  return Object.fromEntries(
    users
      .filter((user) => Boolean(user.signatureParam))
      .map((user) => [user.signatureParam as string, {
        name: user.name,
        position: user.position,
        signatureUrl: user.eSignatureUrl,
      }]),
  )
}

async function resolveOfficialTemplateNames() {
  const [administrator, cswdo, cityMayor, choDoctor] = await Promise.all([
    findActiveOfficialByPosition(['city administrator', 'administrator'], 'reviewer'),
    findActiveOfficialByPosition(['city social welfare and development officer', 'social welfare and development'], 'recommender'),
    findActiveOfficialByPosition(['city mayor', 'mayor'], 'approver'),
    findActiveOfficialProfile(['city health officer', 'health officer', 'medical officer', 'doctor', 'physician'], { role: 'city_health_office' }),
  ])

  return { administrator, cswdo, cityMayor, choDoctor }
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
  const qrCodeDataUrl = `data:image/png;base64,${qrCodeImage.toString('base64')}`
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
  const [officialNames, signatureUsers] = await Promise.all([resolveOfficialTemplateNames(), resolveActiveSignatureUsers()])

  return {
    serialized: {
      ...serialized,
      documentQrCode: assets.qrCodeDataUrl,
      documentVerificationUrl: assets.verificationUrl,
      documentVerificationCode: assets.verificationCode,
      signatureUsers,
      officialAdministratorName: officialNames.administrator,
      officialCswdoName: officialNames.cswdo,
      officialCityMayorName: officialNames.cityMayor,
      officialChoDoctorName: officialNames.choDoctor.name,
      officialChoDoctorPosition: officialNames.choDoctor.position,
    },
    assets,
  }
}

