import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

type GoogleJwk = { kid: string; kty?: string; alg?: string; [key: string]: unknown }

type GoogleIdTokenPayload = {
  iss: string
  aud: string
  exp: number
  sub: string
  email?: string
  email_verified?: boolean | string
  given_name?: string
  family_name?: string
  name?: string
  picture?: string
}

let cachedKeys: { keys: GoogleJwk[]; expiresAt: number } | null = null

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64')
}

function parseJwtPart<T>(value: string): T {
  try {
    return JSON.parse(base64UrlDecode(value).toString('utf8')) as T
  } catch {
    throw new HttpError(401, 'Invalid Google sign-in token')
  }
}

function maxAgeToExpiresAt(cacheControl: string | null) {
  const match = /max-age=(\d+)/i.exec(cacheControl ?? '')
  const seconds = match ? Number(match[1]) : 3600
  return Date.now() + Math.max(seconds, 300) * 1000
}

async function getGoogleKeys() {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs')
  if (!response.ok) throw new HttpError(503, 'Unable to verify Google sign-in right now')

  const body = await response.json() as { keys?: GoogleJwk[] }
  const keys = body.keys?.filter((key) => key.kty === 'RSA' && key.kid) ?? []
  if (keys.length === 0) throw new HttpError(503, 'Unable to verify Google sign-in right now')

  cachedKeys = { keys, expiresAt: maxAgeToExpiresAt(response.headers.get('cache-control')) }
  return keys
}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleIdTokenPayload> {
  if (!env.googleClientId) throw new HttpError(503, 'Google sign-in is not configured')

  const parts = credential.split('.')
  if (parts.length !== 3) throw new HttpError(401, 'Invalid Google sign-in token')

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = parseJwtPart<{ alg?: string; kid?: string }>(encodedHeader)
  const payload = parseJwtPart<GoogleIdTokenPayload>(encodedPayload)

  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'Invalid Google sign-in token')

  const key = (await getGoogleKeys()).find((candidate) => candidate.kid === header.kid)
  if (!key) {
    cachedKeys = null
    throw new HttpError(401, 'Invalid Google sign-in token')
  }

  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(`${encodedHeader}.${encodedPayload}`)
  verifier.end()

  const validSignature = verifier.verify(crypto.createPublicKey({ key: key as crypto.JsonWebKey, format: 'jwk' }), base64UrlDecode(encodedSignature))
  if (!validSignature) throw new HttpError(401, 'Invalid Google sign-in token')

  if (payload.aud !== env.googleClientId) throw new HttpError(401, 'Invalid Google sign-in audience')
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new HttpError(401, 'Invalid Google sign-in issuer')
  if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new HttpError(401, 'Google sign-in token expired')
  if (!payload.sub || !payload.email) throw new HttpError(401, 'Google sign-in did not return an email address')
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new HttpError(401, 'Google email address is not verified')

  return payload
}