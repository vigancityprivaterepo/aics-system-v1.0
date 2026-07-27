import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { UserRole } from '@prisma/client'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { buildBodyFieldKey, softRateLimit } from '../middleware/softRateLimit.js'

const router = Router()

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

function normalizeRole(role: string): UserRole {
  if (role === 'admin') return 'admin'
  if (role === 'city_health_office') return 'city_health_office'
  return 'employee'
}

const APPROVAL_LEVEL_VALUES = ['reviewer', 'recommender', 'approver', 'preparer'] as const
const authCooldownMessage = 'Too many login attempts. Please wait a few minutes and try again.'
const staffLoginIpLimiter = softRateLimit({
  scope: 'staff-auth-ip',
  windowMs: 5 * 60 * 1000,
  maxAttempts: 100,
  cooldownMs: 5 * 60 * 1000,
  message: authCooldownMessage,
})
const staffLoginIdentifierLimiter = softRateLimit({
  scope: 'staff-auth-identifier',
  windowMs: 5 * 60 * 1000,
  maxAttempts: 8,
  cooldownMs: 10 * 60 * 1000,
  key: buildBodyFieldKey('identifier'),
  message: authCooldownMessage,
})

function parseApprovalLevels(stored: string | null | undefined): string[] {
  if (!stored || stored === 'none') return []
  return stored
    .split(',')
    .map((s) => s.trim())
    .filter((s) => (APPROVAL_LEVEL_VALUES as readonly string[]).includes(s))
}

router.post('/login', staffLoginIpLimiter, staffLoginIdentifierLimiter, asyncHandler(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body)
  const normalizedIdentifier = identifier.trim().toLowerCase()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: normalizedIdentifier },
        { email: normalizedIdentifier },
      ],
    },
  })
  if (!user || !user.isActive) {
    throw new HttpError(401, 'Invalid credentials')
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new HttpError(401, 'Invalid credentials')

  const token = jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: normalizeRole(String(user.role)),
      approvalLevel: parseApprovalLevels(user.approvalLevel),
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  )

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: normalizeRole(String(user.role)),
      employeeId: user.employeeId,
      approvalLevel: parseApprovalLevels(user.approvalLevel),
      position: user.position,
      photoUrl: user.photoUrl,
    },
  })
}))

export default router
