import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

// Machine-to-machine auth for the Integration API (routes/integration.ts).
// The calling system sends its key in X-Integration-Key; only the SHA-256
// hash of each key is configured (INTEGRATION_API_KEYS), so the key itself is
// never stored here. A staff or portal token gives no access to these routes,
// and an integration key gives no access to anything else.

export function integrationEnabled() {
  return env.integrationApiKeys.length > 0
}

// With no key configured the Integration API does not exist.
export function requireIntegrationEnabled(_req: Request, _res: Response, next: NextFunction) {
  if (!integrationEnabled()) return next(new HttpError(404, 'Route not found'))
  return next()
}

export function requireIntegrationKey(req: Request, _res: Response, next: NextFunction) {
  const presented = req.get('x-integration-key')
  if (!presented) return next(new HttpError(401, 'Missing integration key'))

  const digest = createHash('sha256').update(presented).digest()
  const match = env.integrationApiKeys.find((key) => key.hash.length === digest.length && timingSafeEqual(key.hash, digest))
  if (!match) return next(new HttpError(401, 'Invalid integration key'))

  req.integrationKeyName = match.name
  return next()
}
