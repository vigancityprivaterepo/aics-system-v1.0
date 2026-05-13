import { prisma } from './prisma.js'

async function getSettings() {
  return prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
    select: { locationCode: true, agencyCode: true, medicinePrefix: true, burialPrefix: true, hospitalPrefix: true, medicalPrefix: true, eyeglassPrefix: true, plainPrefix: true, clientPrefix: true, sequenceDigits: true },
  })
}

export async function generateClientCaseNumber(): Promise<string> {
  const s = await getSettings()
  const prefix = `${s.clientPrefix}-${s.locationCode}-`
  const latest = await prisma.client.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const lastSeq = latest?.caseNumber ? Number(latest.caseNumber.slice(-(s.sequenceDigits))) : 0
  return `${prefix}${String(lastSeq + 1).padStart(s.sequenceDigits, '0')}`
}

export async function generateCaseCaseNumber(assistanceType: 'medicine' | 'burial' | 'hospital' | 'medical' | 'eyeglass' | 'plain'): Promise<string> {
  const s = await getSettings()
  const typePrefix = assistanceType === 'medicine' ? s.medicinePrefix
    : assistanceType === 'hospital' ? s.hospitalPrefix
    : assistanceType === 'medical' ? s.medicalPrefix
    : assistanceType === 'eyeglass' ? s.eyeglassPrefix
    : assistanceType === 'plain' ? s.plainPrefix
    : s.burialPrefix
  const prefix = `${typePrefix}-${s.agencyCode}-${s.locationCode}-`
  const latest = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const lastSeq = latest?.caseNumber ? Number(latest.caseNumber.slice(-(s.sequenceDigits))) : 0
  return `${prefix}${String(lastSeq + 1).padStart(s.sequenceDigits, '0')}`
}
