import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireRole } from '../middleware/auth.js'
import { backendRoot } from '../utils/paths.js'

const router = Router()
const adminOnly = requireRole(['admin'])
const BCRYPT_ROUNDS = 10

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
})

const createApplicantSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  mobileNumber: z.string().trim().optional().nullable(),
  isVerified: z.boolean().optional().default(true),
})

function serializeApplicant(applicant: any) {
  return {
    id: applicant.id,
    email: applicant.email,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    mobileNumber: applicant.mobileNumber,
    isVerified: applicant.isVerified,
    createdAt: applicant.createdAt,
    applicationCount: applicant._count?.applications ?? 0,
    clientId: applicant.client?.id ?? null,
    clientCaseNumber: applicant.client?.caseNumber ?? null,
  }
}

function removeApplicantPortalFiles(applications: Array<{ documents?: Array<{ fileUrl: string | null }> }>) {
  for (const application of applications) {
    for (const document of application.documents ?? []) {
      if (!document.fileUrl) continue
      const relativePath = String(document.fileUrl).replace(/^\/+/, '').replace(/\//g, path.sep)
      const absolutePath = path.resolve(backendRoot, relativePath)
      if (!fs.existsSync(absolutePath)) continue

      try {
        fs.unlinkSync(absolutePath)
      } catch (error) {
        console.error('[Applicant Delete] Failed to remove portal file', absolutePath, error)
      }
    }
  }
}

router.get('/', adminOnly, asyncHandler(async (req, res) => {
  const { page, limit, search } = listQuerySchema.parse(req.query)
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { mobileNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, applicants] = await Promise.all([
    prisma.applicant.count({ where }),
    prisma.applicant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        client: {
          select: {
            id: true,
            caseNumber: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    }),
  ])

  res.json({
    applicants: applicants.map(serializeApplicant),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  })
}))

router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const body = createApplicantSchema.parse(req.body)

  const existing = await prisma.applicant.findUnique({
    where: { email: body.email.trim().toLowerCase() },
    select: { id: true },
  })
  if (existing) {
    throw new HttpError(409, 'An applicant account with this email already exists.')
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)
  const applicant = await prisma.applicant.create({
    data: {
      email: body.email.trim().toLowerCase(),
      passwordHash,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      mobileNumber: body.mobileNumber?.trim() || null,
      isVerified: body.isVerified,
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    },
    include: {
      client: {
        select: {
          id: true,
          caseNumber: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  })

  res.status(201).json({ applicant: serializeApplicant(applicant) })
}))

router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const applicantId = String(req.params.id)
  const applicant = await prisma.applicant.findUnique({
    where: { id: applicantId },
    include: {
      applications: {
        include: {
          documents: true,
        },
      },
      client: {
        select: {
          id: true,
          caseNumber: true,
        },
      },
    },
  })

  if (!applicant) {
    throw new HttpError(404, 'Applicant not found')
  }

  removeApplicantPortalFiles(applicant.applications)
  await prisma.applicant.delete({
    where: { id: applicant.id },
  })

  res.json({
    message: 'Applicant deleted successfully.',
    deleted: {
      id: applicant.id,
      email: applicant.email,
      applicationCount: applicant.applications.length,
      clientId: applicant.client?.id ?? null,
      clientCaseNumber: applicant.client?.caseNumber ?? null,
    },
  })
}))

export default router
