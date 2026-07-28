import { prisma } from './prisma.js'

async function getSettings() {
  return prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
    select: {
      locationCode: true,
      agencyCode: true,
      medicinePrefix: true,
      burialPrefix: true,
      hospitalPrefix: true,
      medicalPrefix: true,
      eyeglassPrefix: true,
      plainPrefix: true,
      clientPrefix: true,
      sequenceDigits: true,
      clientStartSequence: true,
      medicineStartSequence: true,
      burialStartSequence: true,
      hospitalStartSequence: true,
      medicalStartSequence: true,
      eyeglassStartSequence: true,
      plainStartSequence: true,
    },
  })
}

function nextSequence(latestNumber: string | null | undefined, digits: number, startSequence: number) {
  const latestSequence = latestNumber ? Number(latestNumber.slice(-digits)) : 0
  const safeLatestSequence = Number.isFinite(latestSequence) ? latestSequence : 0
  return Math.max(startSequence, safeLatestSequence + 1)
}

export async function generateClientCaseNumber(): Promise<string> {
  const s = await getSettings()
  const prefix = `${s.clientPrefix}-${s.locationCode}-`
  const latest = await prisma.client.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const nextSeq = nextSequence(latest?.caseNumber, s.sequenceDigits, s.clientStartSequence)
  return `${prefix}${String(nextSeq).padStart(s.sequenceDigits, '0')}`
}

export async function generateCaseCaseNumber(assistanceType: 'medicine' | 'burial' | 'hospital' | 'medical' | 'eyeglass' | 'plain'): Promise<string> {
  const s = await getSettings()
  const typePrefix = assistanceType === 'medicine' ? s.medicinePrefix
    : assistanceType === 'hospital' ? s.hospitalPrefix
    : assistanceType === 'medical' ? s.medicalPrefix
    : assistanceType === 'eyeglass' ? s.eyeglassPrefix
    : assistanceType === 'plain' ? s.plainPrefix
    : s.burialPrefix
  const startSequence = assistanceType === 'medicine' ? s.medicineStartSequence
    : assistanceType === 'hospital' ? s.hospitalStartSequence
    : assistanceType === 'medical' ? s.medicalStartSequence
    : assistanceType === 'eyeglass' ? s.eyeglassStartSequence
    : assistanceType === 'plain' ? s.plainStartSequence
    : s.burialStartSequence
  const prefix = `${typePrefix}-${s.agencyCode}-${s.locationCode}-`
  const latest = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const nextSeq = nextSequence(latest?.caseNumber, s.sequenceDigits, startSequence)
  return `${prefix}${String(nextSeq).padStart(s.sequenceDigits, '0')}`
}

