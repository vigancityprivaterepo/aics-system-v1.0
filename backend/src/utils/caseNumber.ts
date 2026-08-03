import type { PrismaClient } from '@prisma/client'
import { prisma } from './prisma.js'
import { logger } from './logger.js'

type NumberingClient = Pick<PrismaClient, 'systemSettings' | 'client' | 'case' | '$executeRaw'>

type NumberingSettings = {
  locationCode: string
  agencyCode: string
  medicinePrefix: string
  burialPrefix: string
  hospitalPrefix: string
  medicalPrefix: string
  eyeglassPrefix: string
  plainPrefix: string
  clientPrefix: string
  sequenceDigits: number
  clientStartSequence: number
  medicineStartSequence: number
  burialStartSequence: number
  hospitalStartSequence: number
  medicalStartSequence: number
  eyeglassStartSequence: number
  plainStartSequence: number
}

const CLIENT_CASE_NUMBER_LOCK_KEY = 20_001
const CASE_NUMBER_LOCK_KEYS: Record<'medicine' | 'burial' | 'hospital' | 'medical' | 'eyeglass' | 'plain', number> = {
  medicine: 21_001,
  burial: 21_002,
  hospital: 21_003,
  medical: 21_004,
  eyeglass: 21_005,
  plain: 21_006,
}

const DEFAULT_NUMBERING_SETTINGS: NumberingSettings = {
  locationCode: 'VGN',
  agencyCode: 'AICS',
  medicinePrefix: 'MD',
  burialPrefix: 'BUR',
  hospitalPrefix: 'HSP',
  medicalPrefix: 'MED',
  eyeglassPrefix: 'EYE',
  plainPrefix: 'PLN',
  clientPrefix: 'CID',
  sequenceDigits: 3,
  clientStartSequence: 1,
  medicineStartSequence: 1,
  burialStartSequence: 1,
  hospitalStartSequence: 1,
  medicalStartSequence: 1,
  eyeglassStartSequence: 1,
  plainStartSequence: 1,
}

async function getSettings(client: NumberingClient = prisma): Promise<NumberingSettings> {
  try {
    return await client.systemSettings.upsert({
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
  } catch (error) {
    logger.warn('Using default numbering settings because system_settings is not fully compatible with the current schema.', {})
    return DEFAULT_NUMBERING_SETTINGS
  }
}

function normalizeToken(value: string, fallback: string) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return cleaned || fallback
}

function normalizeDigits(value: number, fallback: number) {
  const rounded = Math.round(Number(value))
  if (!Number.isFinite(rounded)) return fallback
  return Math.max(2, Math.min(6, rounded))
}

function normalizeStartSequence(value: number, fallback: number) {
  const rounded = Math.round(Number(value))
  if (!Number.isFinite(rounded)) return fallback
  return Math.max(1, rounded)
}

function compactParts(parts: string[], maxCombinedLength: number) {
  const normalized = parts.map((part) => normalizeToken(part, 'X'))
  while (normalized.join('-').length > maxCombinedLength) {
    let longestIndex = -1
    for (let index = 0; index < normalized.length; index += 1) {
      if (normalized[index].length <= 1) continue
      if (longestIndex === -1 || normalized[index].length > normalized[longestIndex].length) {
        longestIndex = index
      }
    }
    if (longestIndex === -1) break
    normalized[longestIndex] = normalized[longestIndex].slice(0, -1)
  }
  return normalized
}

function buildSeriesPrefix(parts: string[], sequenceDigits: number, totalMaxLength: number) {
  const maxCombinedLength = totalMaxLength - sequenceDigits - 1
  const compacted = compactParts(parts, maxCombinedLength)
  return `${compacted.join('-')}-`
}

function nextSequence(latestNumber: string | null | undefined, prefix: string, startSequence: number) {
  const sequenceText = latestNumber?.startsWith(prefix)
    ? latestNumber.slice(prefix.length).match(/^\d+/)?.[0]
    : latestNumber?.match(/(\d+)$/)?.[1]
  const latestSequence = sequenceText ? Number(sequenceText) : 0
  const safeLatestSequence = Number.isFinite(latestSequence) ? latestSequence : 0
  return Math.max(startSequence, safeLatestSequence + 1)
}

async function acquireSequenceLock(client: NumberingClient, lockKey: number) {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`
}

export async function generateClientCaseNumber(): Promise<string> {
  const rawSettings = await getSettings()
  const s: NumberingSettings = {
    ...DEFAULT_NUMBERING_SETTINGS,
    ...rawSettings,
    clientPrefix: normalizeToken(rawSettings.clientPrefix, DEFAULT_NUMBERING_SETTINGS.clientPrefix),
    locationCode: normalizeToken(rawSettings.locationCode, DEFAULT_NUMBERING_SETTINGS.locationCode),
    sequenceDigits: normalizeDigits(rawSettings.sequenceDigits, DEFAULT_NUMBERING_SETTINGS.sequenceDigits),
    clientStartSequence: normalizeStartSequence(rawSettings.clientStartSequence, DEFAULT_NUMBERING_SETTINGS.clientStartSequence),
  }
  const prefix = buildSeriesPrefix([s.clientPrefix, s.locationCode], s.sequenceDigits, 20)
  const latest = await prisma.client.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const nextSeq = nextSequence(latest?.caseNumber, prefix, s.clientStartSequence)
  return `${prefix}${String(nextSeq).padStart(s.sequenceDigits, '0')}`
}

export async function generateCaseCaseNumber(
  assistanceType: 'medicine' | 'burial' | 'hospital' | 'medical' | 'eyeglass' | 'plain',
  client: NumberingClient = prisma,
): Promise<string> {
  await acquireSequenceLock(client, CASE_NUMBER_LOCK_KEYS[assistanceType])
  const rawSettings = await getSettings(client)
  const s: NumberingSettings = {
    ...DEFAULT_NUMBERING_SETTINGS,
    ...rawSettings,
    agencyCode: normalizeToken(rawSettings.agencyCode, DEFAULT_NUMBERING_SETTINGS.agencyCode),
    locationCode: normalizeToken(rawSettings.locationCode, DEFAULT_NUMBERING_SETTINGS.locationCode),
    medicinePrefix: normalizeToken(rawSettings.medicinePrefix, DEFAULT_NUMBERING_SETTINGS.medicinePrefix),
    burialPrefix: normalizeToken(rawSettings.burialPrefix, DEFAULT_NUMBERING_SETTINGS.burialPrefix),
    hospitalPrefix: normalizeToken(rawSettings.hospitalPrefix, DEFAULT_NUMBERING_SETTINGS.hospitalPrefix),
    medicalPrefix: normalizeToken(rawSettings.medicalPrefix, DEFAULT_NUMBERING_SETTINGS.medicalPrefix),
    eyeglassPrefix: normalizeToken(rawSettings.eyeglassPrefix, DEFAULT_NUMBERING_SETTINGS.eyeglassPrefix),
    plainPrefix: normalizeToken(rawSettings.plainPrefix, DEFAULT_NUMBERING_SETTINGS.plainPrefix),
    sequenceDigits: normalizeDigits(rawSettings.sequenceDigits, DEFAULT_NUMBERING_SETTINGS.sequenceDigits),
    medicineStartSequence: normalizeStartSequence(rawSettings.medicineStartSequence, DEFAULT_NUMBERING_SETTINGS.medicineStartSequence),
    burialStartSequence: normalizeStartSequence(rawSettings.burialStartSequence, DEFAULT_NUMBERING_SETTINGS.burialStartSequence),
    hospitalStartSequence: normalizeStartSequence(rawSettings.hospitalStartSequence, DEFAULT_NUMBERING_SETTINGS.hospitalStartSequence),
    medicalStartSequence: normalizeStartSequence(rawSettings.medicalStartSequence, DEFAULT_NUMBERING_SETTINGS.medicalStartSequence),
    eyeglassStartSequence: normalizeStartSequence(rawSettings.eyeglassStartSequence, DEFAULT_NUMBERING_SETTINGS.eyeglassStartSequence),
    plainStartSequence: normalizeStartSequence(rawSettings.plainStartSequence, DEFAULT_NUMBERING_SETTINGS.plainStartSequence),
  }
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
  const prefix = buildSeriesPrefix([typePrefix, s.agencyCode, s.locationCode], s.sequenceDigits, 20)
  const latest = await client.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const nextSeq = nextSequence(latest?.caseNumber, prefix, startSequence)
  return `${prefix}${String(nextSeq).padStart(s.sequenceDigits, '0')}`
}



