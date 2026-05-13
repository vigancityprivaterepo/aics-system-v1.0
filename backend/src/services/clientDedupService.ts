import type { Client, Prisma, PrismaClient } from '@prisma/client'
import { HttpError } from '../utils/httpError.js'

export type PersonMatchInput = {
  applicantId?: string | null
  email?: string | null
  contactNumber?: string | null
  firstName?: string | null
  lastName?: string | null
  middleName?: string | null
  dateOfBirth?: Date | string | null
  sex?: string | null
  barangay?: string | null
  municipality?: string | null
  province?: string | null
}

export type DuplicateStatus = 'no_match' | 'possible_matches' | 'strong_match'

export type DuplicateMatch = {
  id: string
  caseNumber: string
  fullName: string
  firstName: string
  lastName: string
  middleName: string | null
  dateOfBirth: string | null
  sex: string | null
  contactNumber: string | null
  barangay: string | null
  municipality: string | null
  province: string | null
  applicantId: string | null
  applicantEmail: string | null
  latestCaseNumber: string | null
  latestCaseStatus: string | null
  score: number
  matchReasons: string[]
}

export type DuplicateCheckResult = {
  duplicateStatus: DuplicateStatus
  requiresConfirmation: boolean
  matches: DuplicateMatch[]
}

type CandidateClient = Client & {
  applicant: { id: string; email: string } | null
  cases: Array<{ caseNumber: string | null; status: string }>
}

type DedupEventClient = Pick<PrismaClient, 'clientDedupEvent'>

type MergeClient = Pick<PrismaClient, '$transaction'> | Prisma.TransactionClient

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeKey(value: string | null | undefined) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('63') && digits.length === 12) return `0${digits.slice(2)}`
  return digits
}

function normalizeDate(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function middleInitial(value: string | null | undefined) {
  return normalizeKey(value).slice(0, 1)
}

function exactNameMatch(input: PersonMatchInput, candidate: CandidateClient) {
  const firstA = normalizeKey(input.firstName)
  const lastA = normalizeKey(input.lastName)
  const middleA = middleInitial(input.middleName)
  const firstB = normalizeKey(candidate.firstName)
  const lastB = normalizeKey(candidate.lastName)
  const middleB = middleInitial(candidate.middleName)
  if (!firstA || !lastA || !firstB || !lastB) return false
  if (firstA !== firstB || lastA !== lastB) return false
  if (middleA && middleB) return middleA === middleB
  return true
}

function fuzzyNameMatch(input: PersonMatchInput, candidate: CandidateClient) {
  const firstA = normalizeKey(input.firstName)
  const lastA = normalizeKey(input.lastName)
  const firstB = normalizeKey(candidate.firstName)
  const lastB = normalizeKey(candidate.lastName)
  if (!firstA || !lastA || !firstB || !lastB) return false
  const lastExact = lastA === lastB
  const firstNear = firstA === firstB || firstA.startsWith(firstB) || firstB.startsWith(firstA)
  return lastExact && firstNear
}

function serializeMatch(candidate: CandidateClient, score: number, matchReasons: string[]): DuplicateMatch {
  return {
    id: candidate.id,
    caseNumber: candidate.caseNumber,
    fullName: [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    middleName: candidate.middleName ?? null,
    dateOfBirth: candidate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    sex: candidate.sex ?? null,
    contactNumber: candidate.contactNumber ?? null,
    barangay: candidate.barangay ?? null,
    municipality: candidate.municipality ?? null,
    province: candidate.province ?? null,
    applicantId: candidate.applicantId ?? null,
    applicantEmail: candidate.applicant?.email ?? null,
    latestCaseNumber: candidate.cases[0]?.caseNumber ?? null,
    latestCaseStatus: candidate.cases[0]?.status ?? null,
    score,
    matchReasons,
  }
}

function scoreCandidate(input: PersonMatchInput, candidate: CandidateClient) {
  let score = 0
  const reasons: string[] = []

  const applicantIdExact = !!(input.applicantId && candidate.applicantId === input.applicantId)
  if (applicantIdExact) {
    score += 100
    reasons.push('Same linked applicant account')
  }

  const emailExact = !!(input.email && candidate.applicant?.email && normalizeText(input.email) === normalizeText(candidate.applicant.email))
  if (emailExact) {
    score += 95
    reasons.push('Same applicant email')
  }

  const phoneExact = !!(input.contactNumber && candidate.contactNumber && normalizePhone(input.contactNumber) === normalizePhone(candidate.contactNumber))
  if (phoneExact) {
    score += 72
    reasons.push('Same contact number')
  }

  const dobExact = !!(normalizeDate(input.dateOfBirth) && normalizeDate(input.dateOfBirth) === normalizeDate(candidate.dateOfBirth))
  const barangayExact = !!(input.barangay && candidate.barangay && normalizeText(input.barangay) === normalizeText(candidate.barangay))
  const municipalityExact = !!(input.municipality && candidate.municipality && normalizeText(input.municipality) === normalizeText(candidate.municipality))
  const exactName = exactNameMatch(input, candidate)
  const fuzzyName = !exactName && fuzzyNameMatch(input, candidate)

  if (exactName && dobExact) {
    score += 85
    reasons.push('Exact name and birth date match')
  } else if (exactName && barangayExact) {
    score += 68
    reasons.push('Exact name and barangay match')
  } else if (fuzzyName && dobExact) {
    score += 60
    reasons.push('Similar name and same birth date')
  } else if (fuzzyName && (barangayExact || phoneExact || municipalityExact)) {
    score += 55
    reasons.push('Similar name with matching location or contact')
  } else if (exactName) {
    score += 45
    reasons.push('Exact name match')
  }

  return { score, reasons }
}

function strongMatch(score: number, reasons: string[]) {
  return score >= 85 || reasons.includes('Same linked applicant account') || reasons.includes('Same applicant email')
}

export function buildPersonMatchInput(payload: PersonMatchInput): PersonMatchInput {
  return {
    applicantId: payload.applicantId ?? null,
    email: payload.email ?? null,
    contactNumber: payload.contactNumber ?? null,
    firstName: payload.firstName ?? null,
    lastName: payload.lastName ?? null,
    middleName: payload.middleName ?? null,
    dateOfBirth: payload.dateOfBirth ?? null,
    sex: payload.sex ?? null,
    barangay: payload.barangay ?? null,
    municipality: payload.municipality ?? null,
    province: payload.province ?? null,
  }
}

export async function findClientDuplicateMatches(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: PersonMatchInput,
  options: { excludeClientId?: string | null; limit?: number } = {}
): Promise<DuplicateCheckResult> {
  const where: Prisma.ClientWhereInput = {
    mergedIntoClientId: null,
    ...(options.excludeClientId ? { id: { not: options.excludeClientId } } : {}),
    OR: [
      input.applicantId ? { applicantId: input.applicantId } : undefined,
      input.email ? { applicant: { is: { email: { equals: input.email, mode: 'insensitive' } } } } : undefined,
      input.contactNumber ? { contactNumber: { contains: input.contactNumber.replace(/\D/g, '').slice(-7), mode: 'insensitive' } } : undefined,
      input.firstName ? { firstName: { contains: input.firstName, mode: 'insensitive' } } : undefined,
      input.lastName ? { lastName: { contains: input.lastName, mode: 'insensitive' } } : undefined,
      input.barangay ? { barangay: { contains: input.barangay, mode: 'insensitive' } } : undefined,
    ].filter(Boolean) as Prisma.ClientWhereInput[],
  }

  if (!where.OR?.length) {
    return { duplicateStatus: 'no_match', requiresConfirmation: false, matches: [] }
  }

  const candidates = await prisma.client.findMany({
    where,
    include: {
      applicant: { select: { id: true, email: true } },
      cases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { caseNumber: true, status: true },
      },
    },
    take: 20,
  }) as CandidateClient[]

  const matches = candidates
    .map((candidate) => {
      const { score, reasons } = scoreCandidate(input, candidate)
      return { candidate, score, reasons }
    })
    .filter((entry) => entry.score >= 55 || strongMatch(entry.score, entry.reasons))
    .sort((a, b) => b.score - a.score || a.candidate.createdAt.getTime() - b.candidate.createdAt.getTime())
    .slice(0, options.limit ?? 5)
    .map((entry) => serializeMatch(entry.candidate, entry.score, entry.reasons))

  if (!matches.length) return { duplicateStatus: 'no_match', requiresConfirmation: false, matches: [] }

  return {
    duplicateStatus: strongMatch(matches[0].score, matches[0].matchReasons) ? 'strong_match' : 'possible_matches',
    requiresConfirmation: true,
    matches,
  }
}

export function duplicateConflict(message: string, result: DuplicateCheckResult, extra: Record<string, unknown> = {}) {
  return new HttpError(409, message, {
    duplicateStatus: result.duplicateStatus,
    requiresConfirmation: result.requiresConfirmation,
    matches: result.matches,
    ...extra,
  })
}

export async function recordClientDedupEvent(
  client: DedupEventClient | Prisma.TransactionClient,
  input: {
    actorId?: string | null
    applicantId?: string | null
    sourceClientId?: string | null
    targetClientId?: string | null
    action: string
    notes?: string | null
    payload?: Prisma.InputJsonValue
  }
) {
  return client.clientDedupEvent.create({
    data: {
      actorId: input.actorId ?? null,
      applicantId: input.applicantId ?? null,
      sourceClientId: input.sourceClientId ?? null,
      targetClientId: input.targetClientId ?? null,
      action: input.action,
      notes: input.notes ?? null,
      payload: input.payload ?? undefined,
    },
  })
}

export async function mergeClientRecords(
  prisma: Prisma.TransactionClient,
  input: {
    sourceClientId: string
    targetClientId: string
    actorId?: string | null
    notes?: string | null
    payload?: Prisma.InputJsonValue
  }
) {
  if (input.sourceClientId === input.targetClientId) {
    throw new HttpError(400, 'Source and target client must be different.')
  }

  const [source, target] = await Promise.all([
    prisma.client.findUnique({ where: { id: input.sourceClientId } }),
    prisma.client.findUnique({ where: { id: input.targetClientId } }),
  ])

  if (!source || !target) throw new HttpError(404, 'Client not found')
  if (source.mergedIntoClientId) throw new HttpError(400, 'Source client is already merged.')
  if (target.mergedIntoClientId) throw new HttpError(400, 'Target client is already merged into another profile.')
  if (source.applicantId && target.applicantId && source.applicantId !== target.applicantId) {
    throw new HttpError(400, 'Cannot merge two clients that are linked to different portal applicants.')
  }

  if (source.applicantId && !target.applicantId) {
    await prisma.client.update({
      where: { id: source.id },
      data: { applicantId: null },
    })

    await prisma.client.update({
      where: { id: target.id },
      data: { applicantId: source.applicantId },
    })
  }

  await prisma.case.updateMany({
    where: { clientId: source.id },
    data: { clientId: target.id },
  })

  await prisma.client.update({
    where: { id: source.id },
    data: {
      mergedIntoClientId: target.id,
      mergedAt: new Date(),
      mergedByUserId: input.actorId ?? null,
    },
  })

  await recordClientDedupEvent(prisma, {
    actorId: input.actorId ?? null,
    applicantId: source.applicantId ?? target.applicantId ?? null,
    sourceClientId: source.id,
    targetClientId: target.id,
    action: 'admin_merge',
    notes: input.notes ?? null,
    payload: input.payload,
  })

  return prisma.client.findUnique({ where: { id: target.id } })
}
