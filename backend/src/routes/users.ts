import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { CaseStatus } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireRole } from '../middleware/auth.js'
import { eSignatureDirectory, eSignaturePublicUrl, profilePhotoPublicUrl, profilePhotosDirectory } from '../services/storageService.js'
import { removeStoredUpload, validateStoredUpload } from '../services/uploadValidation.js'

const router = Router()

const adminOnly = requireRole(['admin'])
const ACTIVE_ROLES = new Set(['admin', 'employee', 'city_health_office'])
const APPROVAL_LEVEL_VALUES = ['reviewer', 'recommender', 'approver', 'preparer'] as const
const passwordReuseMessage = 'You already used this password. Please create a new password.'

function parseApprovalLevels(stored: string | null | undefined): string[] {
  if (!stored || stored === 'none') return []
  return stored.split(',').map(s => s.trim()).filter((s): s is string =>
    APPROVAL_LEVEL_VALUES.includes(s as typeof APPROVAL_LEVEL_VALUES[number])
  )
}

function serializeApprovalLevels(levels: string[]): string {
  const valid = levels.filter(l => APPROVAL_LEVEL_VALUES.includes(l as typeof APPROVAL_LEVEL_VALUES[number]))
  return valid.length > 0 ? valid.join(',') : 'none'
}

function normalizeUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (!url.includes('/uploads/')) return url
  try {
    const parsed = new URL(url)
    return `${env.apiBaseUrl}${parsed.pathname}`
  } catch {
    const markerIndex = url.indexOf('/uploads/')
    if (markerIndex >= 0) return `${env.apiBaseUrl}${url.slice(markerIndex)}`
    return url
  }
}

const eSignatureUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, eSignatureDirectory()),
    filename: (req, file, cb) => {
      const userId = paramId(req.params.id)
      const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      cb(null, `${Date.now()}-${userId}-${safeOriginal}`)
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
})

const profilePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, profilePhotosDirectory()),
    filename: (req, file, cb) => {
      const userId = paramId(req.params.id)
      const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      cb(null, `${Date.now()}-${userId}-${safeOriginal}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
})

function paramId(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

const createSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3).regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores only'),
  role: z.enum(['employee', 'admin', 'city_health_office']),
  approvalLevel: z.array(z.enum(APPROVAL_LEVEL_VALUES)).optional().default([]),
  position: z.string().max(200).nullable().optional(),
  password: z.string().min(8),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(3).regex(/^[a-z0-9_]+$/).optional(),
  role: z.enum(['employee', 'admin', 'city_health_office']).optional(),
  approvalLevel: z.array(z.enum(APPROVAL_LEVEL_VALUES)).optional(),
  signatureParam: z.string().max(50).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only').nullable().optional(),
  position: z.string().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
})

const selfUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.string().max(200).nullable().optional(),
})

const resetSchema = z.object({
  password: z.string().min(8),
})

const auditTrailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(5),
  search: z.string().trim().max(100).optional(),
})

function safeUser(u: {
  id: string
  name: string
  username: string | null
  email: string
  employeeId: string
  role: string
  approvalLevel: string
  signatureParam: string | null
  position: string | null
  photoUrl: string | null
  eSignatureUrl: string | null
  eSignatureUploadedAt: Date | null
  isActive: boolean
  createdAt: Date
}) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    employeeId: u.employeeId,
    role: u.role,
    approvalLevel: parseApprovalLevels(u.approvalLevel),
    signatureParam: u.signatureParam,
    position: u.position,
    photoUrl: normalizeUploadUrl(u.photoUrl),
    eSignatureUrl: normalizeUploadUrl(u.eSignatureUrl),
    eSignatureUploadedAt: u.eSignatureUploadedAt,
    isActive: u.isActive,
    createdAt: u.createdAt,
  }
}

const userSelect = {
  id: true, name: true, username: true, email: true, employeeId: true,
  role: true, approvalLevel: true, signatureParam: true, position: true,
  photoUrl: true,
  eSignatureUrl: true, eSignatureUploadedAt: true,
  isActive: true, createdAt: true,
} as const

function auditActionLabel(log: { fromStatus: CaseStatus; toStatus: CaseStatus; notes: string | null }) {
  if (log.toStatus === 'for_review') return 'Submitted for review'
  if (log.toStatus === 'recommending_approval') return 'Reviewed and endorsed'
  if (log.toStatus === 'for_approval') return 'Forwarded for final approval'
  if (log.toStatus === 'approved') return 'Case approved'
  if (log.toStatus === 'released') return 'Case released'
  if (log.toStatus === 'rejected') return 'Case rejected'
  if (log.notes?.startsWith('Requirement ')) return 'Requirement updated'
  if (log.fromStatus !== log.toStatus) return 'Case status updated'
  return 'Case updated'
}

router.get('/me', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: userSelect,
  })
  if (!user) throw new HttpError(404, 'User not found')
  res.json(safeUser(user))
}))

router.patch('/me', asyncHandler(async (req, res) => {
  const body = selfUpdateSchema.parse(req.body)
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: body,
    select: userSelect,
  })
  res.json(safeUser(user))
}))

router.get('/', adminOnly, asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: userSelect,
  })
  res.json({
    users: users.filter((u) => {
      const role = String(u.role || '').toLowerCase()
      if (ACTIVE_ROLES.has(role)) return true
      return (
        role.includes('admin') ||
        String(u.username || '').toLowerCase() === 'admin' ||
        String(u.email || '').toLowerCase().includes('admin')
      )
    }),
  })
}))

router.get('/audit-trail', adminOnly, asyncHandler(async (req, res) => {
  const { page, limit, search } = auditTrailQuerySchema.parse(req.query)
  const searchTerm = search?.trim()
  const where = {
    changedBy: {
      is: {
        role: 'employee' as const,
        ...(searchTerm
          ? {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' as const } },
              { employeeId: { contains: searchTerm, mode: 'insensitive' as const } },
            ],
          }
          : {}),
      },
    },
    OR: [
      { notes: { startsWith: 'Requirement ' } },
      { toStatus: { in: ['for_review', 'recommending_approval', 'for_approval', 'approved', 'released'] as CaseStatus[] } },
    ],
  }

  const [total, logs] = await Promise.all([
    prisma.caseStatusLog.count({ where }),
    prisma.caseStatusLog.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        changedBy: {
          select: {
            id: true,
            name: true,
            username: true,
            employeeId: true,
            role: true,
          },
        },
        case: {
          select: {
            id: true,
            assistanceType: true,
            status: true,
            client: {
              select: {
                caseNumber: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
  ])

  res.json({
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    logs: logs.map((log) => ({
      id: log.id,
      changedAt: log.changedAt,
      action: auditActionLabel(log),
      notes: log.notes,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      user: log.changedBy
        ? {
          id: log.changedBy.id,
          name: log.changedBy.name,
          username: log.changedBy.username,
          employeeId: log.changedBy.employeeId,
          role: log.changedBy.role,
        }
        : null,
      case: {
        id: log.case.id,
        assistanceType: log.case.assistanceType,
        status: log.case.status,
        caseNumber: log.case.client.caseNumber,
        clientName: `${log.case.client.lastName}, ${log.case.client.firstName}`,
      },
    })),
  })
}))

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body)

  const existing = await prisma.user.findUnique({ where: { username: body.username } })
  if (existing) throw new HttpError(409, 'Username already in use')

  const employeeId = `AICS-${Date.now()}`
  const email = `${body.username}@aics.local`
  const passwordHash = await bcrypt.hash(body.password, 12)
  const user = await prisma.user.create({
    data: {
      name: body.name,
      username: body.username,
      email,
      employeeId,
      role: body.role,
      approvalLevel: serializeApprovalLevels(body.role === 'city_health_office' ? [] : body.approvalLevel),
      position: body.position ?? null,
      passwordHash,
    },
    select: userSelect,
  })

  res.status(201).json(safeUser(user))
}))

router.patch('/:id', adminOnly, asyncHandler(async (req, res) => {
  const userId = paramId(req.params.id)
  const body = updateSchema.parse(req.body)

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) throw new HttpError(404, 'User not found')

  if (body.username && body.username !== existing.username) {
    const conflict = await prisma.user.findUnique({ where: { username: body.username } })
    if (conflict) throw new HttpError(409, 'Username already in use')
  }

  const { approvalLevel: approvalLevelArr, ...restBody } = body
  const nextApprovalLevels =
    body.role === 'city_health_office'
      ? []
      : approvalLevelArr ?? parseApprovalLevels(existing.approvalLevel)
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...restBody,
      ...((body.role === 'city_health_office' || approvalLevelArr !== undefined)
        ? { approvalLevel: serializeApprovalLevels(nextApprovalLevels) }
        : {}),
    },
    select: userSelect,
  })

  res.json(safeUser(user))
}))

router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const userId = paramId(req.params.id)

  if (userId === req.user?.id) {
    throw new HttpError(400, 'You cannot delete your own account.')
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) throw new HttpError(404, 'User not found')

  // Clean up e-signature file if present
  if (existing.eSignatureUrl?.includes('/uploads/e-signatures/')) {
    const currentFileName = existing.eSignatureUrl.split('/uploads/e-signatures/')[1]
    if (currentFileName) {
      const filePath = path.resolve(eSignatureDirectory(), currentFileName)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
  }

  await prisma.user.delete({ where: { id: userId } })

  res.status(204).send()
}))

router.post('/:id/reset-password', adminOnly, asyncHandler(async (req, res) => {
  const userId = paramId(req.params.id)
  const { password } = resetSchema.parse(req.body)

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) throw new HttpError(404, 'User not found')
  const isReusedPassword = await bcrypt.compare(password, existing.passwordHash)
  if (isReusedPassword) throw new HttpError(400, passwordReuseMessage)

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

  res.json({ message: 'Password reset successfully' })
}))

router.post('/:id/e-signature', eSignatureUpload.single('file'), asyncHandler(async (req, res) => {
  const userId = paramId(req.params.id)
  const file = req.file
  if (!file) throw new HttpError(400, 'No signature file uploaded')
  try {
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      throw new HttpError(403, 'Forbidden')
    }

    await validateStoredUpload(file, 'eSignature')

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) throw new HttpError(404, 'User not found')

    const newUrl = eSignaturePublicUrl(file.filename)

    if (existing.eSignatureUrl?.includes('/uploads/e-signatures/')) {
      const currentFileName = existing.eSignatureUrl.split('/uploads/e-signatures/')[1]
      if (currentFileName) {
        const previousPath = path.resolve(eSignatureDirectory(), currentFileName)
        if (fs.existsSync(previousPath)) {
          fs.unlinkSync(previousPath)
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        eSignatureUrl: newUrl,
        eSignatureUploadedAt: new Date(),
      },
      select: userSelect,
    })

    res.status(201).json(safeUser(updated))
  } catch (error) {
    await removeStoredUpload(file)
    throw error
  }
}))

router.post('/:id/profile-photo', profilePhotoUpload.single('file'), asyncHandler(async (req, res) => {
  const userId = paramId(req.params.id)
  const file = req.file
  if (!file) throw new HttpError(400, 'No profile photo uploaded')
  try {
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      throw new HttpError(403, 'Forbidden')
    }

    await validateStoredUpload(file, 'profilePhoto')

    const existing = await prisma.user.findUnique({ where: { id: userId } })
    if (!existing) throw new HttpError(404, 'User not found')

    const newUrl = profilePhotoPublicUrl(file.filename)
    if (existing.photoUrl?.includes('/uploads/profile-photos/')) {
      const currentFileName = existing.photoUrl.split('/uploads/profile-photos/')[1]
      if (currentFileName) {
        const previousPath = path.resolve(profilePhotosDirectory(), currentFileName)
        if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath)
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { photoUrl: newUrl },
      select: userSelect,
    })
    res.status(201).json(safeUser(updated))
  } catch (error) {
    await removeStoredUpload(file)
    throw error
  }
}))

export default router
