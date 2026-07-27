import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireRole } from '../middleware/auth.js'
import { HttpError } from '../utils/httpError.js'
import { createBackup, getBackupFile, listBackups, restoreBackup } from '../services/backupService.js'
import { logAdminAudit } from '../services/adminAuditService.js'

const router = Router()
const APPROVAL_LEVEL_VALUES = ['reviewer', 'recommender', 'approver'] as const
const adminOnly = requireRole(['admin'])

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function parseApprovalLevels(stored: string | null | undefined): string[] {
  if (!stored || stored === 'none') return []
  return stored
    .split(',')
    .map((part) => part.trim())
    .filter((level): level is string => APPROVAL_LEVEL_VALUES.includes(level as typeof APPROVAL_LEVEL_VALUES[number]))
}

async function getOrCreate() {
  return prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
    include: {
      reviewedByUser: { select: { id: true, name: true, approvalLevel: true } },
      recommendingUser: { select: { id: true, name: true, approvalLevel: true } },
      approvedByUser: { select: { id: true, name: true, approvalLevel: true } },
    },
  })
}

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await getOrCreate())
}))

const updateSchema = z.object({
  locationCode:   z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  agencyCode:     z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  clientPrefix:   z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  medicinePrefix: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  burialPrefix:   z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  hospitalPrefix: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  medicalPrefix:  z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  eyeglassPrefix: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  plainPrefix:    z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  sequenceDigits: z.number().int().min(2).max(6),
  reviewedByUserId: z.string().uuid().nullable().optional(),
  recommendingUserId: z.string().uuid().nullable().optional(),
  approvedByUserId: z.string().uuid().nullable().optional(),
})

router.put('/', requireRole(['admin']), asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body)
  const assignees = [
    { id: body.reviewedByUserId ?? null, requiredLevel: 'reviewer' as const, label: 'Reviewed by' },
    { id: body.recommendingUserId ?? null, requiredLevel: 'recommender' as const, label: 'Recommending Approval' },
    { id: body.approvedByUserId ?? null, requiredLevel: 'approver' as const, label: 'Final Approval' },
  ].filter((x) => !!x.id)

  if (assignees.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: assignees.map((x) => x.id!) } },
      select: { id: true, name: true, approvalLevel: true, isActive: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    for (const assignee of assignees) {
      const user = userMap.get(assignee.id!)
      if (!user) {
        throw new HttpError(400, `${assignee.label} user not found.`)
      }
      if (!user.isActive) {
        throw new HttpError(400, `${assignee.label} user must be active.`)
      }
      const levels = parseApprovalLevels(user.approvalLevel)
      if (!levels.includes(assignee.requiredLevel)) {
        throw new HttpError(400, `${assignee.label} user must have ${assignee.requiredLevel} approval level.`)
      }
    }
  }

  const settings = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...body },
    update: body,
    include: {
      reviewedByUser: { select: { id: true, name: true, approvalLevel: true } },
      recommendingUser: { select: { id: true, name: true, approvalLevel: true } },
      approvedByUser: { select: { id: true, name: true, approvalLevel: true } },
    },
  })
  await logAdminAudit(prisma, {
    actorId: req.user?.id,
    action: 'settings.update',
    targetType: 'system_settings',
    targetId: settings.id,
    summary: 'Updated system settings and approval hierarchy assignments',
    details: {
      locationCode: settings.locationCode,
      agencyCode: settings.agencyCode,
      reviewedByUserId: settings.reviewedByUserId,
      recommendingUserId: settings.recommendingUserId,
      approvedByUserId: settings.approvedByUserId,
      sequenceDigits: settings.sequenceDigits,
    },
  })
  res.json(settings)
}))

router.get('/backups', adminOnly, asyncHandler(async (_req, res) => {
  res.json({
    backups: await listBackups(),
  })
}))

router.post('/backups', adminOnly, asyncHandler(async (_req, res) => {
  const backup = await createBackup()
  await logAdminAudit(prisma, {
    actorId: _req.user?.id,
    action: 'backup.create',
    targetType: 'backup',
    targetId: backup.filename,
    summary: `Created system backup ${backup.filename}`,
    details: backup,
  })
  res.status(201).json(backup)
}))

router.get('/backups/:filename/download', adminOnly, asyncHandler(async (req, res) => {
  const filename = paramValue(req.params.filename)
  const filePath = await getBackupFile(filename)
  await logAdminAudit(prisma, {
    actorId: req.user?.id,
    action: 'backup.download',
    targetType: 'backup',
    targetId: filename,
    summary: `Downloaded system backup ${filename}`,
    details: { filename },
  })
  res.download(filePath, filename)
}))

router.post('/backups/:filename/restore', adminOnly, asyncHandler(async (req, res) => {
  const filename = paramValue(req.params.filename)
  await restoreBackup(filename)
  await logAdminAudit(prisma, {
    actorId: req.user?.id,
    action: 'backup.restore',
    targetType: 'backup',
    targetId: filename,
    summary: `Restored system backup ${filename}`,
    details: { filename },
  })
  res.json({ ok: true })
}))

export default router
