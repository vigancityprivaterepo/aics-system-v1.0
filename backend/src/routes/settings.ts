import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireRole } from '../middleware/auth.js'
import { HttpError } from '../utils/httpError.js'
import { createBackup, getBackupFile, listBackups, restoreBackup, restoreBackupFromUpload } from '../services/backupService.js'
import { logAdminAudit } from '../services/adminAuditService.js'
import {
  buildModuleAccessConfig,
  buildModuleAccessOverrides,
  getAccessibleModulesForUser,
  getModuleAccessConfig,
  serializeModuleAccessConfig,
  serializeModuleAccessOverrides,
} from '../services/moduleAccessService.js'

const router = Router()
const backupUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } })
const APPROVAL_LEVEL_VALUES = ['reviewer', 'recommender', 'approver'] as const
const adminOnly = requireRole(['admin'])
const ASSISTANCE_TYPES = ['medicine', 'burial', 'hospital', 'medical', 'eyeglass', 'plain'] as const
const NARRATIVE_FIELDS = ['presenting_problem', 'findings'] as const

const SERIES_CONFIG = {
  client: { prefixField: 'clientPrefix', sequenceField: 'clientStartSequence', label: 'Client ID' },
  medicine: { prefixField: 'medicinePrefix', sequenceField: 'medicineStartSequence', label: 'Medicine' },
  burial: { prefixField: 'burialPrefix', sequenceField: 'burialStartSequence', label: 'Burial' },
  hospital: { prefixField: 'hospitalPrefix', sequenceField: 'hospitalStartSequence', label: 'Hospital' },
  medical: { prefixField: 'medicalPrefix', sequenceField: 'medicalStartSequence', label: 'Medical' },
  eyeglass: { prefixField: 'eyeglassPrefix', sequenceField: 'eyeglassStartSequence', label: 'Eyeglass' },
  plain: { prefixField: 'plainPrefix', sequenceField: 'plainStartSequence', label: 'Plain AICS' },
} as const

const seriesParamSchema = z.enum(['client', 'medicine', 'burial', 'hospital', 'medical', 'eyeglass', 'plain'])
const caseNumberSeriesSchema = z.object({
  prefix: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/i),
  startSequence: z.number().int().min(1).max(999999),
})
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
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
    include: {
      reviewedByUser: { select: { id: true, name: true, approvalLevel: true } },
      recommendingUser: { select: { id: true, name: true, approvalLevel: true } },
      approvedByUser: { select: { id: true, name: true, approvalLevel: true } },
    },
  })
  return {
    ...settings,
    moduleAccessConfig: buildModuleAccessConfig(settings.moduleAccessConfig),
  }
}

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await getOrCreate())
}))

router.get('/narrative-options', asyncHandler(async (req, res) => {
  const parsedType = z.enum(ASSISTANCE_TYPES).optional().safeParse(req.query.assistanceType)
  const assistanceType = parsedType.success ? parsedType.data : undefined
  const includeInactive = req.user?.role === 'admin' && req.query.includeInactive === 'true'
  res.json({
    options: await prisma.narrativeOption.findMany({
      where: {
        ...(assistanceType ? { assistanceType } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ assistanceType: 'asc' }, { field: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    }),
  })
}))

const narrativeOptionSchema = z.object({
  assistanceType: z.enum(ASSISTANCE_TYPES),
  field: z.enum(NARRATIVE_FIELDS),
  label: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(5000),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
})

router.post('/narrative-options', adminOnly, asyncHandler(async (req, res) => {
  const option = await prisma.narrativeOption.create({ data: narrativeOptionSchema.parse(req.body) })
  await logAdminAudit(prisma, { actorId: req.user?.id, action: 'narrative_option.create', targetType: 'narrative_option', targetId: option.id, summary: `Created ${option.assistanceType} ${option.field} option` })
  res.status(201).json(option)
}))

router.put('/narrative-options/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = paramValue(req.params.id)
  const option = await prisma.narrativeOption.update({ where: { id }, data: narrativeOptionSchema.parse(req.body) })
  await logAdminAudit(prisma, { actorId: req.user?.id, action: 'narrative_option.update', targetType: 'narrative_option', targetId: option.id, summary: `Updated ${option.assistanceType} ${option.field} option` })
  res.json(option)
}))

router.delete('/narrative-options/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = paramValue(req.params.id)
  const option = await prisma.narrativeOption.delete({ where: { id } })
  await logAdminAudit(prisma, { actorId: req.user?.id, action: 'narrative_option.delete', targetType: 'narrative_option', targetId: option.id, summary: `Deleted ${option.assistanceType} ${option.field} option` })
  res.status(204).send()
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
  clientStartSequence: z.number().int().min(1).max(999999),
  medicineStartSequence: z.number().int().min(1).max(999999),
  burialStartSequence: z.number().int().min(1).max(999999),
  hospitalStartSequence: z.number().int().min(1).max(999999),
  medicalStartSequence: z.number().int().min(1).max(999999),
  eyeglassStartSequence: z.number().int().min(1).max(999999),
  plainStartSequence: z.number().int().min(1).max(999999),
  reviewedByUserId: z.string().uuid().nullable().optional(),
  recommendingUserId: z.string().uuid().nullable().optional(),
  approvedByUserId: z.string().uuid().nullable().optional(),
  moduleAccessConfig: z.unknown().optional(),
})

const moduleAccessUpdateSchema = z.object({
  moduleAccessConfig: z.unknown(),
})

const employeeModuleAccessUpdateSchema = z.object({
  moduleAccessOverrides: z.unknown(),
})


router.patch('/case-number-series/:series', adminOnly, asyncHandler(async (req, res) => {
  const seriesKey = seriesParamSchema.parse(paramValue(req.params.series))
  const body = caseNumberSeriesSchema.parse({
    ...req.body,
    startSequence: Number(req.body?.startSequence),
  })
  const config = SERIES_CONFIG[seriesKey]
  const data = {
    [config.prefixField]: body.prefix.toUpperCase(),
    [config.sequenceField]: body.startSequence,
  }

  const settings = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
    include: {
      reviewedByUser: { select: { id: true, name: true, approvalLevel: true } },
      recommendingUser: { select: { id: true, name: true, approvalLevel: true } },
      approvedByUser: { select: { id: true, name: true, approvalLevel: true } },
    },
  })

  await logAdminAudit(prisma, {
    actorId: req.user?.id,
    action: 'settings.case_number_series.update',
    targetType: 'system_settings',
    targetId: settings.id,
    summary: `Updated ${config.label} case number series`,
    details: {
      series: seriesKey,
      prefixField: config.prefixField,
      sequenceField: config.sequenceField,
      prefix: body.prefix.toUpperCase(),
      startSequence: body.startSequence,
    },
  })

  res.json({
    ...settings,
    moduleAccessConfig: buildModuleAccessConfig(settings.moduleAccessConfig),
  })
}))

router.patch('/module-access', adminOnly, asyncHandler(async (req, res) => {
  const body = moduleAccessUpdateSchema.parse(req.body)
  const moduleAccessConfig = buildModuleAccessConfig(body.moduleAccessConfig)
  const serializedConfig = serializeModuleAccessConfig(moduleAccessConfig)
  const settings = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', moduleAccessConfig: serializedConfig },
    update: { moduleAccessConfig: serializedConfig },
  })

  await logAdminAudit(prisma, {
    actorId: req.user?.id,
    action: 'settings.module_access.update',
    targetType: 'system_settings',
    targetId: settings.id,
    summary: 'Updated module access by office',
    details: { moduleAccessConfig },
  })

  res.json({ moduleAccessConfig })
}))

router.patch('/module-access/employees/:userId', adminOnly, asyncHandler(async (req, res) => {
  const userId = z.string().uuid().parse(paramValue(req.params.userId))
  const body = employeeModuleAccessUpdateSchema.parse(req.body)
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, department: true },
  })
  if (!existingUser) throw new HttpError(404, 'Employee not found.')
  if (String(existingUser.role) === 'admin') {
    throw new HttpError(400, 'Administrator access cannot be overridden.')
  }

  const moduleAccessOverrides = buildModuleAccessOverrides(body.moduleAccessOverrides)
  const serializedOverrides = serializeModuleAccessOverrides(moduleAccessOverrides)
  await prisma.user.update({
    where: { id: userId },
    data: { moduleAccessOverrides: serializedOverrides },
  })

  const moduleAccessConfig = await getModuleAccessConfig()
  const accessibleModules = getAccessibleModulesForUser({
    role: String(existingUser.role),
    department: existingUser.department,
    moduleAccessOverrides,
  }, moduleAccessConfig)

  await logAdminAudit(prisma, {
    actorId: req.user?.id,
    action: 'settings.employee_module_access.update',
    targetType: 'user',
    targetId: existingUser.id,
    summary: `Updated module access overrides for ${existingUser.name}`,
    details: { moduleAccessOverrides, accessibleModules },
  })

  res.json({ userId, moduleAccessOverrides, accessibleModules })
}))

router.put('/', requireRole(['admin']), asyncHandler(async (req, res) => {
  const body = updateSchema.parse(req.body)
  const { moduleAccessConfig: rawModuleAccessConfig, ...settingsFields } = body
  const moduleAccessConfig = rawModuleAccessConfig === undefined
    ? null
    : buildModuleAccessConfig(rawModuleAccessConfig)
  const settingsData = {
    ...settingsFields,
    ...(moduleAccessConfig ? { moduleAccessConfig: serializeModuleAccessConfig(moduleAccessConfig) } : {}),
  }
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
    create: {
      id: 'singleton',
      ...settingsData,
    },
    update: {
      ...settingsData,
    },
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
      clientStartSequence: settings.clientStartSequence,
      medicineStartSequence: settings.medicineStartSequence,
      burialStartSequence: settings.burialStartSequence,
      hospitalStartSequence: settings.hospitalStartSequence,
      medicalStartSequence: settings.medicalStartSequence,
      eyeglassStartSequence: settings.eyeglassStartSequence,
      plainStartSequence: settings.plainStartSequence,
      ...(moduleAccessConfig ? { moduleAccessConfig } : {}),
    },
  })
  res.json({
    ...settings,
    moduleAccessConfig: buildModuleAccessConfig(settings.moduleAccessConfig),
  })
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

// A restore replaces the entire users table with whatever the snapshot contains -
// the currently signed-in admin's own row may not exist in it (an older backup, or
// one from a different environment/seed). Logging the action afterward with that
// now-possibly-gone actorId can then fail its foreign key check. That must never
// turn an otherwise-successful restore into a reported failure, so audit logging
// here is best-effort: log a warning and move on rather than rethrowing.
async function logRestoreAuditBestEffort(input: Parameters<typeof logAdminAudit>[1]) {
  try {
    await logAdminAudit(prisma, input)
  } catch (error) {
    console.warn('[settings] failed to write restore audit log (restore itself still succeeded):', error)
  }
}

router.post('/backups/:filename/restore', adminOnly, asyncHandler(async (req, res) => {
  const filename = paramValue(req.params.filename)
  await restoreBackup(filename)
  await logRestoreAuditBestEffort({
    actorId: req.user?.id,
    action: 'backup.restore',
    targetType: 'backup',
    targetId: filename,
    summary: `Restored system backup ${filename}`,
    details: { filename },
  })
  res.json({ ok: true })
}))

router.post('/backups/upload-restore', adminOnly, backupUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'A backup file is required.')
  const backup = await restoreBackupFromUpload(req.file.buffer)
  await logRestoreAuditBestEffort({
    actorId: req.user?.id,
    action: 'backup.restore_upload',
    targetType: 'backup',
    targetId: backup.filename,
    summary: `Restored system backup from an uploaded file (${req.file.originalname})`,
    details: { filename: backup.filename, originalName: req.file.originalname },
  })
  res.json(backup)
}))

export default router

