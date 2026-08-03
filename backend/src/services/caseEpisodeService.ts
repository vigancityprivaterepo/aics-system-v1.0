import type { AssistanceType, Prisma } from '@prisma/client'
import { HttpError } from '../utils/httpError.js'

function summarizeProblem(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return fallback
  return normalized.length > 120 ? `${normalized.slice(0, 117).trim()}...` : normalized
}

function assistanceTypeLabel(type: AssistanceType) {
  if (type === 'plain') return 'Plain AICS'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function buildEpisodeTitle(input: {
  assistanceType: AssistanceType
  presentingProblem?: string | null
  referenceNumber?: string | null
}) {
  const referenceNumber = String(input.referenceNumber ?? '').trim()
  if (referenceNumber) return `Portal request ${referenceNumber}`

  return summarizeProblem(
    input.presentingProblem,
    `${assistanceTypeLabel(input.assistanceType)} assistance event`,
  )
}

export async function resolveCaseEpisodeForCreate(
  tx: Prisma.TransactionClient,
  input: {
    clientId: string
    assistanceType: AssistanceType
    openedByUserId?: string | null
    episodeId?: string | null
    sourceApplicantApplicationId?: string | null
    presentingProblem?: string | null
    dateOfAssessment?: Date | null
    referenceNumber?: string | null
  },
) {
  const requestedEpisodeId = input.episodeId?.trim() || null

  if (requestedEpisodeId) {
    const existingEpisode = await tx.caseEpisode.findUnique({
      where: { id: requestedEpisodeId },
      select: {
        id: true,
        clientId: true,
      },
    })
    if (!existingEpisode) {
      throw new HttpError(404, 'Selected case episode was not found.')
    }
    if (existingEpisode.clientId !== input.clientId) {
      throw new HttpError(400, 'Selected case episode belongs to a different client.')
    }
    return existingEpisode
  }

  return tx.caseEpisode.create({
    data: {
      clientId: input.clientId,
      openedByUserId: input.openedByUserId ?? null,
      sourceApplicantApplicationId: input.sourceApplicantApplicationId ?? null,
      title: buildEpisodeTitle({
        assistanceType: input.assistanceType,
        presentingProblem: input.presentingProblem ?? null,
        referenceNumber: input.referenceNumber ?? null,
      }),
      summary: input.presentingProblem?.trim() || null,
      crisisStartedAt: input.dateOfAssessment ?? null,
      status: 'open',
    },
    select: {
      id: true,
      clientId: true,
    },
  })
}

export async function syncCaseEpisodeStatus(
  tx: Prisma.TransactionClient,
  episodeId: string | null | undefined,
) {
  if (!episodeId) return null

  const activeSibling = await tx.case.findFirst({
    where: {
      caseEpisodeId: episodeId,
      isArchived: false,
      status: {
        notIn: ['released', 'rejected'],
      },
    },
    select: { id: true },
  })

  return tx.caseEpisode.update({
    where: { id: episodeId },
    data: {
      status: activeSibling ? 'open' : 'closed',
    },
    select: {
      id: true,
      status: true,
    },
  })
}
