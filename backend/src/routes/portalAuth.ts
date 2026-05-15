import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requirePortalAuth, signPortalToken } from '../middleware/portalAuth.js'
import { buildEmailKey, softRateLimit } from '../middleware/softRateLimit.js'
import { sendMail, otpEmailHtml, passwordResetEmailHtml } from '../services/mailer.js'
import { sendSms, otpSmsMessage } from '../services/sms.js'
import { env } from '../config/env.js'
import { generateClientCaseNumber } from '../utils/caseNumber.js'
import { buildPersonMatchInput, findClientDuplicateMatches, recordClientDedupEvent } from '../services/clientDedupService.js'

const router = Router()

const BCRYPT_ROUNDS = 10
const OTP_EXPIRY_MINUTES = 10
const OTP_MAX_ATTEMPTS = 3
const authCooldownMessage = 'Too many attempts. Please wait a few minutes and try again.'
const passwordReuseMessage = 'You already used this password. Please create a new password.'
const otpFlowIpLimiter = softRateLimit({
  scope: 'portal-auth-ip',
  windowMs: 5 * 60 * 1000,
  maxAttempts: 20,
  cooldownMs: 2 * 60 * 1000,
  message: authCooldownMessage,
})
const otpFlowEmailLimiter = (scope: string, maxAttempts: number) => softRateLimit({
  scope,
  windowMs: 5 * 60 * 1000,
  maxAttempts,
  cooldownMs: 2 * 60 * 1000,
  key: buildEmailKey(),
  message: authCooldownMessage,
})

// ── Helpers ────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(Math.floor(100000 + crypto.randomInt(900000)))
}

function otpExpiry(): Date {
  const d = new Date()
  d.setMinutes(d.getMinutes() + OTP_EXPIRY_MINUTES)
  return d
}

async function sendOtpEmailOrThrow(email: string, firstName: string, otp: string) {
  try {
    await sendMail({
      to: email,
      subject: 'Your AICS Verification Code',
      html: otpEmailHtml(firstName, otp),
    })
  } catch {
    throw new HttpError(503, 'Unable to deliver the verification code right now. Please try again in a moment.')
  }
}

async function syncApplicantClient(applicant: {
  id: string
  email: string
  firstName: string
  lastName: string
  middleName: string | null
  dateOfBirth: Date | null
  sex: string | null
  civilStatus: string | null
  barangay: string | null
  municipality: string | null
  province: string | null
  region: string | null
  mobileNumber: string | null
  occupation: string | null
  religion: string | null
  is4ps: boolean
  isPwd: boolean
  isSenior: boolean
}) {
  const payload = {
    applicantId: applicant.id,
    lastName: applicant.lastName,
    firstName: applicant.firstName,
    middleName: applicant.middleName,
    dateOfBirth: applicant.dateOfBirth,
    sex: applicant.sex,
    civilStatus: applicant.civilStatus,
    barangay: applicant.barangay,
    municipality: applicant.municipality,
    province: applicant.province,
    region: applicant.region,
    contactNumber: applicant.mobileNumber,
    occupation: applicant.occupation,
    religion: applicant.religion,
    is4ps: applicant.is4ps,
    isPwd: applicant.isPwd,
    isSenior: applicant.isSenior,
  }

  const existing = await prisma.client.findUnique({
    where: { applicantId: applicant.id },
    select: { id: true },
  })

  if (existing) {
    await prisma.client.update({
      where: { id: existing.id },
      data: payload,
    })
    return
  }

  const duplicateResult = await findClientDuplicateMatches(prisma, buildPersonMatchInput({
    applicantId: applicant.id,
    email: applicant.email,
    contactNumber: applicant.mobileNumber,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    middleName: applicant.middleName,
    dateOfBirth: applicant.dateOfBirth,
    sex: applicant.sex,
    barangay: applicant.barangay,
    municipality: applicant.municipality,
    province: applicant.province,
  }))

  if (duplicateResult.duplicateStatus === 'strong_match') {
    const reusable = duplicateResult.matches.find((match) => !match.applicantId)
    if (reusable) {
      await prisma.client.update({
        where: { id: reusable.id },
        data: payload,
      })

      await recordClientDedupEvent(prisma, {
        applicantId: applicant.id,
        targetClientId: reusable.id,
        action: 'portal_auto_link_existing_client',
        notes: 'Portal profile automatically linked to an existing client profile with a strong duplicate match.',
        payload: {
          duplicateStatus: duplicateResult.duplicateStatus,
          matchId: reusable.id,
          score: reusable.score,
        },
      })
      return
    }
  }

  const caseNumber = await generateClientCaseNumber()
  await prisma.client.create({
    data: {
      caseNumber,
      clientCategory: 'walk_in',
      ...payload,
    },
  })

  if (duplicateResult.duplicateStatus !== 'no_match') {
    await recordClientDedupEvent(prisma, {
      applicantId: applicant.id,
      action: 'portal_created_new_client_despite_possible_duplicate',
      notes: 'Portal sync created a new client because the matched existing profile was already linked or required staff review.',
      payload: {
        duplicateStatus: duplicateResult.duplicateStatus,
        matches: duplicateResult.matches.map((match) => ({ id: match.id, score: match.score })),
      },
    })
  }
}

function serializeApplicant(a: {
  id: string; email: string; mobileNumber: string | null; firstName: string; lastName: string;
  middleName: string | null; dateOfBirth: Date | null; sex: string | null; civilStatus: string | null;
  barangay: string | null; municipality: string | null; province: string | null; region: string | null;
  occupation: string | null; religion: string | null; is4ps: boolean; isPwd: boolean; isSenior: boolean;
  createdAt: Date;
  client?: { id: string; caseNumber: string } | null;
}) {
  return {
    id: a.id,
    email: a.email,
    mobileNumber: a.mobileNumber,
    firstName: a.firstName,
    lastName: a.lastName,
    middleName: a.middleName,
    dateOfBirth: a.dateOfBirth,
    sex: a.sex,
    civilStatus: a.civilStatus,
    barangay: a.barangay,
    municipality: a.municipality,
    province: a.province,
    region: a.region,
    occupation: a.occupation,
    religion: a.religion,
    is4ps: a.is4ps,
    isPwd: a.isPwd,
    isSenior: a.isSenior,
    clientId: a.client?.id ?? null,
    clientCaseNumber: a.client?.caseNumber ?? null,
    createdAt: a.createdAt,
  }
}

async function loadPortalApplicant(applicantId: string) {
  return prisma.applicant.findUnique({
    where: { id: applicantId },
    include: {
      client: {
        select: {
          id: true,
          caseNumber: true,
        },
      },
    },
  })
}

function isApplicantProfileComplete(applicant: {
  firstName: string
  lastName: string
  mobileNumber: string | null
  dateOfBirth: Date | null
  sex: string | null
  civilStatus: string | null
  barangay: string | null
  municipality: string | null
  province: string | null
  region: string | null
  occupation: string | null
  religion: string | null
}) {
  return Boolean(
    applicant.firstName?.trim()
    && applicant.lastName?.trim()
    && applicant.mobileNumber?.trim()
    && applicant.dateOfBirth
    && applicant.sex?.trim()
    && applicant.civilStatus?.trim()
    && applicant.barangay?.trim()
    && applicant.municipality?.trim()
    && applicant.province?.trim()
    && applicant.region?.trim()
    && applicant.occupation?.trim()
    && applicant.religion?.trim()
  )
}

// ── Schemas ────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mobileNumber: z.string().optional(),
})

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().nullable().optional(),
  mobileNumber: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  sex: z.string().nullable().optional(),
  civilStatus: z.string().nullable().optional(),
  barangay: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  occupation: z.string().nullable().optional(),
  religion: z.string().nullable().optional(),
  is4ps: z.boolean().optional(),
  isPwd: z.boolean().optional(),
  isSenior: z.boolean().optional(),
})

// ── POST /register ─────────────────────────────────────────────────────────

router.post('/register', asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body)

  const existing = await prisma.applicant.findUnique({ where: { email: body.email } })
  if (existing) {
    if (existing.isVerified) throw new HttpError(409, 'Unable to create account with the provided details. Please sign in or use password recovery if you already registered.')
    // Resend OTP for unverified account
    const otp = generateOtp()
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS)
    await prisma.applicant.update({
      where: { id: existing.id },
      data: { otpHash, otpExpiresAt: otpExpiry(), otpAttempts: 0 },
    })
    await sendOtpEmailOrThrow(body.email, existing.firstName, otp)
    return res.status(200).json({ message: 'Verification code resent. Please check your email.' })
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)
  const otp = generateOtp()
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS)

  const applicant = await prisma.applicant.create({
    data: {
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      mobileNumber: body.mobileNumber ?? null,
      otpHash,
      otpExpiresAt: otpExpiry(),
    },
  })

  await syncApplicantClient(applicant)
  await sendOtpEmailOrThrow(body.email, body.firstName, otp)

  // Send SMS if mobile provided
  if (body.mobileNumber) {
    sendSms(body.mobileNumber, otpSmsMessage(otp)).catch(console.error)
  }

  res.status(201).json({ message: 'Registration successful. Check your email for the verification code.' })
}))

// ── POST /verify-otp ───────────────────────────────────────────────────────

router.post('/verify-otp', otpFlowIpLimiter, otpFlowEmailLimiter('portal-auth-verify-otp-email', 6), asyncHandler(async (req, res) => {
  const { email, otp } = verifyOtpSchema.parse(req.body)

  const applicant = await prisma.applicant.findUnique({ where: { email } })
  if (!applicant || applicant.isVerified) throw new HttpError(400, 'Invalid or expired verification code.')

  if (!applicant.otpHash || !applicant.otpExpiresAt) {
    throw new HttpError(400, 'Invalid or expired verification code.')
  }
  if (new Date() > applicant.otpExpiresAt) {
    throw new HttpError(400, 'Invalid or expired verification code.')
  }
  if (applicant.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new HttpError(429, 'Too many attempts. Please request a new verification code.')
  }

  const valid = await bcrypt.compare(otp, applicant.otpHash)
  if (!valid) {
    await prisma.applicant.update({
      where: { id: applicant.id },
      data: { otpAttempts: { increment: 1 } },
    })
    throw new HttpError(400, 'Invalid or expired verification code.')
  }

  const verified = await prisma.applicant.update({
    where: { id: applicant.id },
    data: { isVerified: true, otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
  })

  await syncApplicantClient(verified)
  const portalApplicant = await loadPortalApplicant(verified.id)
  if (!portalApplicant) throw new HttpError(404, 'Account not found')

  const token = signPortalToken(verified)
  res.json({ token, applicant: serializeApplicant(portalApplicant) })
}))

// ── POST /resend-otp ───────────────────────────────────────────────────────

router.post('/resend-otp', otpFlowIpLimiter, otpFlowEmailLimiter('portal-auth-resend-otp-email', 4), asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body)

  const applicant = await prisma.applicant.findUnique({ where: { email } })
  if (!applicant || applicant.isVerified) {
    return res.json({ message: 'If the account still needs verification, a new code will be sent.' })
  }

  const otp = generateOtp()
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS)
  await prisma.applicant.update({
    where: { id: applicant.id },
    data: { otpHash, otpExpiresAt: otpExpiry(), otpAttempts: 0 },
  })

  await sendOtpEmailOrThrow(email, applicant.firstName, otp)

  if (applicant.mobileNumber) {
    sendSms(applicant.mobileNumber, otpSmsMessage(otp)).catch(console.error)
  }

  res.json({ message: 'If the account still needs verification, a new code will be sent.' })
}))

// ── POST /login ────────────────────────────────────────────────────────────

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)

  const applicant = await prisma.applicant.findUnique({ where: { email } })
  if (!applicant) throw new HttpError(401, 'Invalid email or password')

  if (!applicant.isVerified) {
    throw new HttpError(403, 'Please verify your email before logging in.')
  }

  const valid = await bcrypt.compare(password, applicant.passwordHash)
  if (!valid) throw new HttpError(401, 'Invalid email or password')

  await syncApplicantClient(applicant)
  const portalApplicant = await loadPortalApplicant(applicant.id)
  if (!portalApplicant) throw new HttpError(404, 'Account not found')

  const token = signPortalToken(applicant)
  res.json({ token, applicant: serializeApplicant(portalApplicant) })
}))

// ── POST /forgot-password ──────────────────────────────────────────────────

router.post('/forgot-password', otpFlowIpLimiter, otpFlowEmailLimiter('portal-auth-forgot-password-email', 4), asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body)

  const applicant = await prisma.applicant.findUnique({ where: { email } })
  // Always respond 200 to prevent email enumeration
  if (!applicant) {
    return res.json({ message: 'If that email is registered, a reset link has been sent.' })
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS)

  await prisma.applicant.update({
    where: { id: applicant.id },
    data: { otpHash: tokenHash, otpExpiresAt: new Date(Date.now() + 30 * 60 * 1000), otpAttempts: 0 },
  })

  const portalUrl = process.env.PORTAL_URL ?? 'http://localhost:5174'
  const resetLink = `${portalUrl}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`

  sendMail({
    to: email,
    subject: 'AICS Password Reset',
    html: passwordResetEmailHtml(applicant.firstName, resetLink),
  }).catch(console.error)

  res.json({ message: 'If that email is registered, a reset link has been sent.' })
}))

// ── POST /reset-password ───────────────────────────────────────────────────

router.post('/reset-password', otpFlowIpLimiter, otpFlowEmailLimiter('portal-auth-reset-password-email', 6), asyncHandler(async (req, res) => {
  const { email, token, newPassword } = resetPasswordSchema.parse(req.body)

  const applicant = await prisma.applicant.findUnique({ where: { email } })
  if (!applicant?.otpHash || !applicant.otpExpiresAt) {
    throw new HttpError(400, 'Invalid or expired reset link')
  }
  if (new Date() > applicant.otpExpiresAt) {
    throw new HttpError(400, 'Invalid or expired reset link')
  }

  const valid = await bcrypt.compare(token, applicant.otpHash)
  if (!valid) throw new HttpError(400, 'Invalid or expired reset link')
  const isReusedPassword = await bcrypt.compare(newPassword, applicant.passwordHash)
  if (isReusedPassword) throw new HttpError(400, passwordReuseMessage)

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await prisma.applicant.update({
    where: { id: applicant.id },
    data: { passwordHash, otpHash: null, otpExpiresAt: null, otpAttempts: 0 },
  })

  res.json({ message: 'Password reset successfully. You can now log in.' })
}))

// ── GET /me ────────────────────────────────────────────────────────────────

router.get('/me', requirePortalAuth, asyncHandler(async (req, res) => {
  const applicant = await loadPortalApplicant(req.applicant!.id)
  if (!applicant) throw new HttpError(404, 'Account not found')
  res.json(serializeApplicant(applicant))
}))

// ── PUT /me ────────────────────────────────────────────────────────────────

router.put('/me', requirePortalAuth, asyncHandler(async (req, res) => {
  const body = updateProfileSchema.parse(req.body)
  const existingApplicant = await prisma.applicant.findUnique({
    where: { id: req.applicant!.id },
  })

  if (!existingApplicant) {
    throw new HttpError(404, 'Account not found')
  }

  if (isApplicantProfileComplete(existingApplicant)) {
    throw new HttpError(403, 'Your profile is already finalized. Please contact the admin office for any changes.')
  }

  const updated = await prisma.applicant.update({
    where: { id: existingApplicant.id },
    data: {
      ...body,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
    },
  })

  await syncApplicantClient(updated)
  const portalApplicant = await loadPortalApplicant(updated.id)
  if (!portalApplicant) throw new HttpError(404, 'Account not found')

  res.json(serializeApplicant(portalApplicant))
}))

export default router
