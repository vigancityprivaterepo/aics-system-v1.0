import type { Request } from 'express'
import { HttpError } from '../utils/httpError.js'

type KeyBuilder = (req: Request) => string | null | undefined

type SoftRateLimitOptions = {
  scope: string
  windowMs: number
  maxAttempts: number
  cooldownMs: number
  key?: KeyBuilder
  message?: string
}

type RateLimitEntry = {
  attempts: number[]
  blockedUntil: number
}

const store = new Map<string, RateLimitEntry>()

function getClientIp(req: Request) {
  return req.ip || 'unknown'
}

function normalizeKeyPart(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export function buildEmailKey(field = 'email'): KeyBuilder {
  return (req) => {
    const body = req.body as Record<string, unknown> | undefined
    const value = typeof body?.[field] === 'string' ? body[field] : null
    const normalized = normalizeKeyPart(value)
    return normalized || null
  }
}

export function softRateLimit(options: SoftRateLimitOptions) {
  return (req: Request, _res: unknown, next: (error?: unknown) => void) => {
    const keyValue = options.key ? options.key(req) : getClientIp(req)
    const normalizedKey = normalizeKeyPart(keyValue)
    if (!normalizedKey) {
      next()
      return
    }

    const now = Date.now()
    const storeKey = `${options.scope}:${normalizedKey}`
    const existing = store.get(storeKey)
    const attempts = (existing?.attempts ?? []).filter((timestamp) => now - timestamp <= options.windowMs)
    const blockedUntil = existing?.blockedUntil ?? 0

    if (blockedUntil > now) {
      next(new HttpError(429, options.message ?? 'Too many attempts. Please wait a few minutes and try again.'))
      return
    }

    attempts.push(now)
    if (attempts.length > options.maxAttempts) {
      store.set(storeKey, { attempts, blockedUntil: now + options.cooldownMs })
      next(new HttpError(429, options.message ?? 'Too many attempts. Please wait a few minutes and try again.'))
      return
    }

    store.set(storeKey, { attempts, blockedUntil: 0 })
    next()
  }
}
