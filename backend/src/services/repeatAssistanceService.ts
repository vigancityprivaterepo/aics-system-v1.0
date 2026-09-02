import { CaseStatus, type AssistanceType } from '@prisma/client'
import { HttpError } from '../utils/httpError.js'
import { currencyFromDb } from '../utils/currency.js'
import { logger } from '../utils/logger.js'

const OPEN_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.intake,
  CaseStatus.requirements,
  CaseStatus.encoding,
  CaseStatus.for_review,
  CaseStatus.recommending_approval,
  CaseStatus.for_approval,
  CaseStatus.approved,
]

function normalizeStatus(status: CaseStatus) {
  return status === CaseStatus.requirements ? CaseStatus.encoding : status
}

function statusLabel(status: CaseStatus) {
  return String(normalizeStatus(status)).replace(/_/g, ' ')
}

function caseReferenceDate(caseRow: any) {
  return caseRow.dateOfAssessment instanceof Date
    ? caseRow.dateOfAssessment
    : caseRow.createdAt instanceof Date
      ? caseRow.createdAt
      : new Date()
}

function isMissingLegacyColumnError(error: unknown, columnName: string) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.toLowerCase().includes(columnName.toLowerCase())
}

// Assistance types that are considered the same "kind" of assistance for cooldown
// purposes: an open/recent case of any type in a client's group blocks a new
// application for any other type in that same group. Hospital and medical cases
// both require selecting a hospital facility and cover the same hospitalization
// event, so they conflict with each other. Medicine, plain AICS, eyeglass, and
// burial assistance each address a distinct need and only conflict with a repeat
// of themselves — medicine can be combined with medical, hospital, plain, or
// eyeglass assistance even within the cooldown window.
const ASSISTANCE_CONFLICT_GROUPS: AssistanceType[][] = [
  ['hospital', 'medical'] as AssistanceType[],
  ['medicine'] as AssistanceType[],
  ['burial'] as AssistanceType[],
  ['eyeglass'] as AssistanceType[],
  ['plain'] as AssistanceType[],
]

function conflictingAssistanceTypes(assistanceType: AssistanceType): AssistanceType[] {
  const group = ASSISTANCE_CONFLICT_GROUPS.find((types) => types.includes(assistanceType))
  return group ?? [assistanceType]
}

export async function findRepeatAssistanceConflicts(
  db: any,
  input: {
    clientId: string
    assistanceType: AssistanceType
    cooldownDays: number
    excludeCaseId?: string | null
    beneficiaryName?: string | null
  },
) {
  const cooldownDays = Math.max(0, Math.round(Number(input.cooldownDays || 0)))
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - cooldownDays)
  const normalizedBeneficiaryName = String(input.beneficiaryName ?? '').trim()
  const conflictingTypes = conflictingAssistanceTypes(input.assistanceType)

  // A case's beneficiary is the client themself unless a beneficiaryName override is
  // set (e.g. a case created for a household member found in the client's family
  // composition). Only compare cooldown conflicts against other cases for the same
  // beneficiary, so a case for a family member doesn't collide with the client's own.
  // Only cases whose assistance type conflicts with the one being applied for count
  // (see ASSISTANCE_CONFLICT_GROUPS) — e.g. medicine + plain AICS, or medicine +
  // eyeglass, are allowed to coexist and are not treated as repeats of each other.
  const buildWhere = (includeArchiveFilter: boolean) => ({
    clientId: input.clientId,
    assistanceType: { in: conflictingTypes },
    beneficiaryName: normalizedBeneficiaryName
      ? { equals: normalizedBeneficiaryName, mode: 'insensitive' as const }
      : null,
    ...(includeArchiveFilter ? { isArchived: false } : {}),
    ...(input.excludeCaseId ? { id: { not: input.excludeCaseId } } : {}),
    OR: [
      { status: { in: OPEN_CASE_STATUSES } },
      {
        status: CaseStatus.released,
        OR: [
          { dateOfAssessment: { gte: cutoff } },
          { createdAt: { gte: cutoff } },
        ],
      },
    ],
  })

  let rows: any[]
  try {
    rows = await db.case.findMany({
      where: buildWhere(true),
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        caseNumber: true,
        assistanceType: true,
        status: true,
        amount: true,
        createdAt: true,
        dateOfAssessment: true,
      },
    })
  } catch (error) {
    if (!isMissingLegacyColumnError(error, 'isArchived')) throw error

    logger.warn('Repeat assistance check is using legacy cases schema fallback without isArchived filter.', {
      clientId: input.clientId,
    })

    rows = await db.case.findMany({
      where: buildWhere(false),
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        caseNumber: true,
        assistanceType: true,
        status: true,
        amount: true,
        createdAt: true,
        dateOfAssessment: true,
      },
    })
  }

  const conflicts = rows.map((row: any) => {
    const referenceDate = caseReferenceDate(row)
    const active = OPEN_CASE_STATUSES.includes(row.status)
    const withinCooldown = !active && cooldownDays > 0 && referenceDate.getTime() >= cutoff.getTime()
    const daysSinceReference = Math.max(0, Math.floor((Date.now() - referenceDate.getTime()) / (24 * 60 * 60 * 1000)))

    return {
      id: row.id,
      caseNumber: row.caseNumber ?? null,
      assistanceType: row.assistanceType as AssistanceType,
      status: normalizeStatus(row.status as CaseStatus),
      statusLabel: statusLabel(row.status as CaseStatus),
      amount: currencyFromDb(row.amount),
      createdAt: row.createdAt?.toISOString?.() ?? null,
      dateOfAssessment: row.dateOfAssessment?.toISOString?.().slice(0, 10) ?? null,
      active,
      withinCooldown,
      daysSinceReference,
      reason: active
        ? `Client already has an active ${statusLabel(row.status as CaseStatus)} case.`
        : `Client received released assistance within the ${cooldownDays}-day cooldown window.`,
    }
  })

  return {
    cooldownDays,
    hasConflicts: conflicts.length > 0,
    conflicts,
  }
}

export function repeatAssistanceConflict(result: Awaited<ReturnType<typeof findRepeatAssistanceConflicts>>) {
  const primary = result.conflicts[0]
  const summary = primary?.active
    ? 'Client already has an active or unreleased assistance case.'
    : `Client has recent released assistance within the ${result.cooldownDays}-day cooldown period.`

  return new HttpError(409, `${summary} Review the recent case history before creating another case.`, {
    conflictType: 'repeat_assistance',
    cooldownDays: result.cooldownDays,
    recentCases: result.conflicts,
  })
}
