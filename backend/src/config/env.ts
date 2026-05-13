import dotenv from 'dotenv'

dotenv.config()

function parseCsv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseTrustProxy(value: string | undefined): boolean | number | string {
  const normalized = String(value ?? '').trim()
  if (!normalized) return false
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  if (/^\d+$/.test(normalized)) return Number(normalized)
  return normalized
}

function isLocalUrl(value: string) {
  try {
    const parsed = new URL(value)
    return ['localhost', '127.0.0.1'].includes(parsed.hostname)
  } catch {
    return true
  }
}

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isProduction = nodeEnv === 'production'
const port = Number(process.env.PORT ?? 5000)
const databaseUrl = required('DATABASE_URL')
const jwtSecret = required('JWT_SECRET')
const portalJwtSecret = required('PORTAL_JWT_SECRET')
const apiBaseUrl = process.env.API_BASE_URL ?? (isProduction ? '' : `http://localhost:${port}`)
const corsOrigin = process.env.CORS_ORIGIN ?? ''
const documentVerifySecret = process.env.DOCUMENT_VERIFY_SECRET ?? portalJwtSecret

if (portalJwtSecret === jwtSecret) {
  throw new Error(
    'PORTAL_JWT_SECRET must be different from JWT_SECRET. Using the same secret for both allows staff tokens to be accepted as portal tokens.',
  )
}

export const env = {
  nodeEnv,
  isProduction,
  port,
  apiBaseUrl,
  corsOrigin,
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  burialGlMaxAmount: Number(process.env.BURIAL_GL_MAX_AMOUNT ?? 10000),
  hospitalGlMaxAmount: Number(process.env.HOSPITAL_GL_MAX_AMOUNT ?? 10000),
  uploadsRoot: process.env.UPLOAD_ROOT ?? 'uploads',
  portalJwtSecret,
  portalJwtExpiresIn: process.env.PORTAL_JWT_EXPIRES_IN ?? '30d',
  documentVerifySecret,
  libreOfficePath: process.env.LIBREOFFICE_PATH ?? '',
  portalEmailNotificationStatuses: parseCsv(process.env.PORTAL_EMAIL_NOTIFICATION_STATUSES ?? 'approved,released,rejected'),
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'AICS Vigan City <noreply@vigancity.gov.ph>',
  semaphoreApiKey: process.env.SEMAPHORE_API_KEY ?? '',
  semaphoreSenderId: process.env.SEMAPHORE_SENDER_ID ?? 'AICS',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY ?? (isProduction ? 'true' : 'false')),
  rateLimitMode: process.env.RATE_LIMIT_MODE ?? 'memory',
}

export function hasSmtpConfig() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom)
}

export function hasSmsConfig() {
  return Boolean(env.semaphoreApiKey && env.semaphoreSenderId)
}

export function getProductionConfigErrors() {
  if (!env.isProduction) return []

  const errors: string[] = []

  if (env.jwtSecret.length < 32) errors.push('JWT_SECRET must be at least 32 characters in production.')
  if (env.portalJwtSecret.length < 32) errors.push('PORTAL_JWT_SECRET must be at least 32 characters in production.')
  if (!env.documentVerifySecret || env.documentVerifySecret.length < 32) {
    errors.push('DOCUMENT_VERIFY_SECRET must be set to a strong secret in production.')
  }
  if (!env.apiBaseUrl) errors.push('API_BASE_URL is required in production.')
  if (env.apiBaseUrl && isLocalUrl(env.apiBaseUrl)) errors.push('API_BASE_URL cannot point to localhost in production.')
  if (!env.corsOrigin) errors.push('CORS_ORIGIN is required in production.')
  if (!hasSmtpConfig()) errors.push('SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM are required in production.')
  if (!hasSmsConfig()) errors.push('SEMAPHORE_API_KEY and SEMAPHORE_SENDER_ID are required in production.')
  if (!env.databaseUrl) errors.push('DATABASE_URL is required in production.')

  return errors
}

export function getRuntimeReadinessIssues() {
  return getProductionConfigErrors()
}
