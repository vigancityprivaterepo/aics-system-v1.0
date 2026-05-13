import crypto from 'node:crypto'
import QRCode from 'qrcode'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

export type DocumentVerificationKind = 'guarantee-letter' | 'case-study'

const DOCUMENT_VERSION = 1
const KIND_PREFIX: Record<DocumentVerificationKind, string> = {
  'guarantee-letter': 'gl',
  'case-study': 'cs',
}
const PREFIX_KIND: Record<string, DocumentVerificationKind> = {
  gl: 'guarantee-letter',
  cs: 'case-study',
}

type DocumentTokenPayload = {
  v: number
  kind: DocumentVerificationKind
  caseId: string
  caseNumber: string
  assistanceType: string
  verificationCode: string
}

export type DocumentVerificationResult = DocumentTokenPayload & {
  issuedAt?: string
  valid: true
}

function buildVerificationCode(input: {
  kind: DocumentVerificationKind
  caseId: string
  caseNumber: string
  assistanceType: string
}) {
  return crypto
    .createHmac('sha256', env.documentVerifySecret)
    .update(`${input.kind}|${input.caseId}|${input.caseNumber}|${input.assistanceType}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()
}

export function generateDocumentVerificationCode(input: {
  kind: DocumentVerificationKind
  caseId: string
  caseNumber: string
  assistanceType: string
}) {
  return buildVerificationCode(input)
}

export function generateGuaranteeLetterVerificationCode(input: {
  caseId: string
  caseNumber: string
  assistanceType: string
}) {
  return generateDocumentVerificationCode({ ...input, kind: 'guarantee-letter' })
}

export function generateCaseStudyVerificationCode(input: {
  caseId: string
  caseNumber: string
  assistanceType: string
}) {
  return generateDocumentVerificationCode({ ...input, kind: 'case-study' })
}

export function createDocumentVerificationToken(input: {
  kind: DocumentVerificationKind
  caseId: string
  caseNumber: string
  assistanceType: string
}) {
  const verificationCode = buildVerificationCode(input)
  return `${KIND_PREFIX[input.kind]}.${input.caseId}.${verificationCode}`
}

export function createGuaranteeLetterVerificationToken(input: {
  caseId: string
  caseNumber: string
  assistanceType: string
}) {
  return createDocumentVerificationToken({ ...input, kind: 'guarantee-letter' })
}

export function createCaseStudyVerificationToken(input: {
  caseId: string
  caseNumber: string
  assistanceType: string
}) {
  return createDocumentVerificationToken({ ...input, kind: 'case-study' })
}

export function verifyDocumentToken(token: string): DocumentVerificationResult {
  const compactMatch = token.match(/^([a-z]{2})\.([0-9a-f-]{36})\.([A-Z0-9]{12})$/i)
  if (compactMatch) {
    const kind = PREFIX_KIND[compactMatch[1].toLowerCase()]
    if (!kind) throw new HttpError(400, 'Invalid document verification token')
    return {
      v: DOCUMENT_VERSION,
      kind,
      caseId: compactMatch[2],
      caseNumber: '',
      assistanceType: '',
      verificationCode: compactMatch[3].toUpperCase(),
      valid: true,
    }
  }

  const legacyGuaranteeLetterMatch = token.match(/^([0-9a-f-]{36})\.([A-Z0-9]{12})$/i)
  if (legacyGuaranteeLetterMatch) {
    return {
      v: DOCUMENT_VERSION,
      kind: 'guarantee-letter',
      caseId: legacyGuaranteeLetterMatch[1],
      caseNumber: '',
      assistanceType: '',
      verificationCode: legacyGuaranteeLetterMatch[2].toUpperCase(),
      valid: true,
    }
  }

  try {
    const decoded = jwt.verify(token, env.documentVerifySecret)
    if (!decoded || typeof decoded !== 'object') throw new Error('Invalid token payload')
    const payload = decoded as Partial<DocumentTokenPayload>
    if (
      payload.v !== DOCUMENT_VERSION ||
      !payload.kind ||
      !payload.caseId ||
      !payload.caseNumber ||
      !payload.assistanceType ||
      !payload.verificationCode
    ) {
      throw new Error('Incomplete token payload')
    }

    const expectedCode = buildVerificationCode({
      kind: payload.kind,
      caseId: payload.caseId,
      caseNumber: payload.caseNumber,
      assistanceType: payload.assistanceType,
    })
    if (expectedCode !== payload.verificationCode) {
      throw new Error('Verification code mismatch')
    }

    return {
      v: payload.v,
      kind: payload.kind,
      caseId: payload.caseId,
      caseNumber: payload.caseNumber,
      assistanceType: payload.assistanceType,
      verificationCode: payload.verificationCode,
      valid: true,
    }
  } catch {
    throw new HttpError(400, 'Invalid or tampered document verification token')
  }
}

export function verifyGuaranteeLetterToken(token: string) {
  const result = verifyDocumentToken(token)
  if (result.kind !== 'guarantee-letter') {
    throw new HttpError(400, 'This verification token is not for a guarantee letter')
  }
  return result
}

export function buildDocumentVerificationUrl(token: string) {
  return `${env.apiBaseUrl}/api/documents/verify/${encodeURIComponent(token)}`
}

export function buildGuaranteeLetterVerificationUrl(token: string) {
  return buildDocumentVerificationUrl(token)
}

export async function buildDocumentQrCodeDataUrl(token: string) {
  const verificationUrl = buildDocumentVerificationUrl(token)
  return QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'L',
    margin: 1,
    width: 220,
  })
}

export async function buildDocumentQrCodeBuffer(token: string) {
  const verificationUrl = buildDocumentVerificationUrl(token)
  return QRCode.toBuffer(verificationUrl, {
    errorCorrectionLevel: 'L',
    margin: 1,
    width: 220,
    type: 'png',
  })
}

export async function buildGuaranteeLetterQrCodeDataUrl(token: string) {
  return buildDocumentQrCodeDataUrl(token)
}

export async function buildGuaranteeLetterQrCodeBuffer(token: string) {
  return buildDocumentQrCodeBuffer(token)
}
