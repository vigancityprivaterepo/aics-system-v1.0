import crypto from 'node:crypto'
import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { HttpError } from './httpError.js'

const IDEMPOTENCY_HEADER = 'idempotency-key'
const DEFAULT_TTL_MS = 10 * 60 * 1000

type JsonResponse = {
  status: number
  body: Record<string, unknown>
}

type IdempotentOptions<TBody> = {
  req: Request
  res: Response
  scope: string
  body: TBody
  ttlMs?: number
  execute: () => Promise<JsonResponse>
}

function toJsonResponseBody(body: Record<string, unknown>) {
  return normalizeValue(body) as Prisma.InputJsonValue & Record<string, unknown>
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue)
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeValue((value as Record<string, unknown>)[key])
        return acc
      }, {})
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return value
}

function hashRequestBody(body: unknown) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalizeValue(body)))
    .digest('hex')
}

function getIdempotencyKey(req: Request) {
  const value = req.get(IDEMPOTENCY_HEADER)?.trim()
  if (!value) return null
  if (value.length > 255) {
    throw new HttpError(400, 'Idempotency-Key must be 255 characters or fewer.')
  }
  return value
}

async function claimIdempotencyKey(scope: string, key: string, requestHash: string, ttlMs: number) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMs)

  try {
    const record = await prisma.idempotencyKey.create({
      data: {
        scope,
        key,
        requestHash,
        expiresAt,
      },
    })
    return { kind: 'claimed' as const, record }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error
    }
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      scope_key: {
        scope,
        key,
      },
    },
  })

  if (!existing) {
    throw new HttpError(409, 'Unable to process the idempotent request right now. Please try again.')
  }

  if (existing.requestHash !== requestHash) {
    throw new HttpError(409, 'This Idempotency-Key was already used for a different request.')
  }

  if (existing.status === 'completed' && existing.responseStatus && existing.responseBody) {
    return { kind: 'replay' as const, record: existing }
  }

  if (existing.expiresAt <= now) {
    const takeover = await prisma.idempotencyKey.updateMany({
      where: {
        id: existing.id,
        expiresAt: { lte: now },
      },
      data: {
        requestHash,
        status: 'in_progress',
        responseStatus: null,
        responseBody: Prisma.JsonNull,
        completedAt: null,
        expiresAt,
      },
    })

    if (takeover.count > 0) {
      const refreshed = await prisma.idempotencyKey.findUniqueOrThrow({
        where: { id: existing.id },
      })
      return { kind: 'claimed' as const, record: refreshed }
    }
  }

  throw new HttpError(409, 'A request with this Idempotency-Key is already being processed.')
}

export async function respondIdempotentJson<TBody>({
  req,
  res,
  scope,
  body,
  ttlMs = DEFAULT_TTL_MS,
  execute,
}: IdempotentOptions<TBody>) {
  const idempotencyKey = getIdempotencyKey(req)
  if (!idempotencyKey) {
    const response = await execute()
    return res.status(response.status).json(response.body)
  }

  const requestHash = hashRequestBody(body)
  const claim = await claimIdempotencyKey(scope, idempotencyKey, requestHash, ttlMs)

  if (claim.kind === 'replay') {
    return res.status(claim.record.responseStatus!).json(claim.record.responseBody as Record<string, unknown>)
  }

  try {
    const response = await execute()
    const responseBody = toJsonResponseBody(response.body)
    await prisma.idempotencyKey.update({
      where: { id: claim.record.id },
      data: {
        status: 'completed',
        responseStatus: response.status,
        responseBody,
        completedAt: new Date(),
      },
    })
    return res.status(response.status).json(responseBody)
  } catch (error) {
    await prisma.idempotencyKey.deleteMany({
      where: {
        id: claim.record.id,
        status: 'in_progress',
      },
    })
    throw error
  }
}
