import fs from 'node:fs/promises'
import path from 'node:path'
import { gzip, gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { backupsRoot, resolveFromBackups, uploadsRoot } from '../utils/paths.js'

const BACKUP_PREFIX = 'aics-backup-'
const BACKUP_EXTENSION = '.json.gz'
const TEMP_ROOT = resolveFromBackups('_tmp')
const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

type BackupDbPayload = Awaited<ReturnType<typeof exportDatabase>>

interface BackupMetadata {
  version: 1
  createdAt: string
  filename: string
  uploadedFilesIncluded: boolean
}

interface BackupUploadFile {
  relativePath: string
  contentBase64: string
}

interface BackupSnapshot {
  metadata: BackupMetadata
  database: BackupDbPayload
  uploads: BackupUploadFile[]
}

function isMissingTableError(error: unknown, tableName?: string) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; meta?: { table?: string } }
  return candidate.code === 'P2021'
    && (!tableName || candidate.meta?.table === tableName)
}

async function safeFindMany<T>(label: string, query: () => Promise<T[]>, tableName?: string): Promise<T[]> {
  try {
    return await query()
  } catch (error) {
    if (isMissingTableError(error, tableName)) {
      return []
    }
    throw new Error(`Failed to export ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function safeCreateMany(label: string, query: () => Promise<unknown>, tableName?: string) {
  try {
    await query()
  } catch (error) {
    if (isMissingTableError(error, tableName)) {
      return
    }
    throw new Error(`Failed to restore ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function existingPublicTables() {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `
  return new Set(rows.map((row) => row.tablename))
}

async function ensureBackupDirs() {
  await fs.mkdir(backupsRoot, { recursive: true })
  await fs.mkdir(TEMP_ROOT, { recursive: true })
}

async function fileExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function timestampLabel(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-')
}

function backupFilename(date = new Date()) {
  return `${BACKUP_PREFIX}${timestampLabel(date)}${BACKUP_EXTENSION}`
}

function resolveManagedBackupPath(filename: string) {
  if (!filename.startsWith(BACKUP_PREFIX) || !filename.endsWith(BACKUP_EXTENSION) || filename.includes('/') || filename.includes('\\')) {
    throw new HttpError(400, 'Invalid backup filename.')
  }
  return resolveFromBackups(filename)
}

async function safeRemove(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true })
}

async function collectUploadFiles(directory: string, prefix = ''): Promise<BackupUploadFile[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files: BackupUploadFile[] = []

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectUploadFiles(absolutePath, relativePath))
      continue
    }

    if (!entry.isFile()) continue
    const content = await fs.readFile(absolutePath)
    files.push({
      relativePath,
      contentBase64: content.toString('base64'),
    })
  }

  return files
}

async function writeUploadFiles(files: BackupUploadFile[]) {
  for (const file of files) {
    const normalizedRelativePath = file.relativePath.split('/').join(path.sep)
    const absolutePath = path.join(uploadsRoot, normalizedRelativePath)
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, Buffer.from(file.contentBase64, 'base64'))
  }
}

async function exportDatabase() {
  const [
    users,
    applicants,
    clients,
    systemSettings,
    medicineItems,
    hospitalFacilities,
    funeralHomes,
    cases,
    caseRequirements,
    caseMedicines,
    burialDetails,
    hospitalDetails,
    medicalDetails,
    eyeglassDetails,
    plainDetails,
    caseApprovals,
    applicantApplications,
    applicantApplicationDocuments,
    clientDedupEvents,
    adminAuditLogs,
    caseStatusLogs,
    idempotencyKeys,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.applicant.findMany(),
    prisma.client.findMany(),
    prisma.systemSettings.findMany(),
    prisma.medicineItem.findMany(),
    prisma.hospitalFacility.findMany(),
    prisma.funeralHome.findMany(),
    prisma.case.findMany(),
    prisma.caseRequirement.findMany(),
    prisma.caseMedicine.findMany(),
    prisma.burialDetail.findMany(),
    prisma.hospitalDetail.findMany(),
    prisma.medicalDetail.findMany(),
    prisma.eyeglassDetail.findMany(),
    prisma.plainDetail.findMany(),
    prisma.caseApproval.findMany(),
    prisma.applicantApplication.findMany(),
    prisma.applicantApplicationDocument.findMany(),
    prisma.clientDedupEvent.findMany(),
    safeFindMany('admin audit logs', () => prisma.adminAuditLog.findMany(), 'public.admin_audit_logs'),
    prisma.caseStatusLog.findMany(),
    safeFindMany('idempotency keys', () => prisma.idempotencyKey.findMany(), 'public.idempotency_keys'),
  ])

  return {
    users,
    applicants,
    clients,
    systemSettings,
    medicineItems,
    hospitalFacilities,
    funeralHomes,
    cases,
    caseRequirements,
    caseMedicines,
    burialDetails,
    hospitalDetails,
    medicalDetails,
    eyeglassDetails,
    plainDetails,
    caseApprovals,
    applicantApplications,
    applicantApplicationDocuments,
    clientDedupEvents,
    adminAuditLogs,
    caseStatusLogs,
    idempotencyKeys,
  }
}

async function buildBackupSnapshot(filename: string): Promise<BackupSnapshot> {
  const database = await exportDatabase()
  const metadata: BackupMetadata = {
    version: 1,
    createdAt: new Date().toISOString(),
    filename,
    uploadedFilesIncluded: await fileExists(uploadsRoot),
  }

  return {
    metadata,
    database,
    uploads: metadata.uploadedFilesIncluded ? await collectUploadFiles(uploadsRoot) : [],
  }
}

async function truncateApplicationTables(tx: Prisma.TransactionClient) {
  const availableTables = await existingPublicTables()
  const truncateOrder = [
    'applicant_application_documents',
    'applicant_applications',
      'case_approvals',
      'admin_audit_logs',
      'case_status_logs',
    'client_dedup_events',
    'case_medicines',
    'case_requirements',
    'burial_details',
    'hospital_details',
    'medical_details',
    'eyeglass_details',
    'plain_details',
    'cases',
    'clients',
    'applicants',
    'system_settings',
    'medicine_items',
    'hospital_facilities',
    'funeral_homes',
    'users',
    'idempotency_keys',
  ].filter((tableName) => availableTables.has(tableName))

  if (truncateOrder.length === 0) return

  await tx.$executeRawUnsafe(`
    TRUNCATE TABLE ${truncateOrder.map((tableName) => `"${tableName}"`).join(', ')}
    RESTART IDENTITY CASCADE
  `)
}

async function importDatabase(payload: BackupDbPayload) {
  await prisma.$transaction(async (tx) => {
    await truncateApplicationTables(tx)

    await tx.user.createMany({ data: payload.users })
    await tx.applicant.createMany({ data: payload.applicants })
    await tx.client.createMany({
      data: payload.clients.map((item) => ({
        ...item,
        familyComposition: (item as any).familyComposition === null ? Prisma.JsonNull : (item as any).familyComposition,
      })),
    })
    await tx.systemSettings.createMany({ data: payload.systemSettings })
    await tx.medicineItem.createMany({ data: payload.medicineItems })
    await tx.hospitalFacility.createMany({ data: payload.hospitalFacilities })
    await tx.funeralHome.createMany({ data: payload.funeralHomes })
    await tx.case.createMany({
      data: payload.cases.map((item) => ({
        ...item,
        familyComposition: item.familyComposition === null ? Prisma.JsonNull : item.familyComposition,
        auditFlags: item.auditFlags === null ? Prisma.JsonNull : item.auditFlags,
      })),
    })
    await tx.caseRequirement.createMany({ data: payload.caseRequirements })
    await tx.caseMedicine.createMany({ data: payload.caseMedicines })
    await tx.burialDetail.createMany({ data: payload.burialDetails })
    await tx.hospitalDetail.createMany({ data: payload.hospitalDetails })
    await tx.medicalDetail.createMany({ data: payload.medicalDetails })
    await tx.eyeglassDetail.createMany({ data: payload.eyeglassDetails })
    await tx.plainDetail.createMany({ data: payload.plainDetails })
    await tx.caseApproval.createMany({ data: payload.caseApprovals })
    await tx.applicantApplication.createMany({
      data: payload.applicantApplications.map((item) => ({
        ...item,
        householdMembers: item.householdMembers === null ? Prisma.JsonNull : item.householdMembers,
        metadata: item.metadata === null ? Prisma.JsonNull : item.metadata,
      })),
    })
    await tx.applicantApplicationDocument.createMany({ data: payload.applicantApplicationDocuments })
    await tx.clientDedupEvent.createMany({
      data: payload.clientDedupEvents.map((item) => ({
        ...item,
        payload: item.payload === null ? Prisma.JsonNull : item.payload,
      })),
    })
    await safeCreateMany('admin audit logs', () => tx.adminAuditLog.createMany({
      data: payload.adminAuditLogs.map((item) => ({
        ...item,
        details: item.details === null ? Prisma.JsonNull : item.details,
      })),
    }), 'public.admin_audit_logs')
    await tx.caseStatusLog.createMany({ data: payload.caseStatusLogs })
    await safeCreateMany('idempotency keys', () => tx.idempotencyKey.createMany({
      data: payload.idempotencyKeys.map((item) => ({
        ...item,
        responseBody: item.responseBody === null ? Prisma.JsonNull : item.responseBody,
      })),
    }), 'public.idempotency_keys')
  })
}

function statToSummary(filename: string, stats: { size: number; mtime: Date }) {
  return {
    filename,
    sizeBytes: stats.size,
    updatedAt: stats.mtime.toISOString(),
  }
}

export async function listBackups() {
  await ensureBackupDirs()
  const entries = await fs.readdir(backupsRoot, { withFileTypes: true })
  const backups = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(BACKUP_PREFIX) && entry.name.endsWith(BACKUP_EXTENSION))
    .map(async (entry) => {
      const stats = await fs.stat(resolveFromBackups(entry.name))
      return statToSummary(entry.name, stats)
    }))

  backups.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return backups
}

export async function createBackup() {
  await ensureBackupDirs()

  const filename = backupFilename()
  const archivePath = resolveFromBackups(filename)
  try {
    const snapshot = await buildBackupSnapshot(filename)
    const compressed = await gzipAsync(Buffer.from(JSON.stringify(snapshot), 'utf8'))
    await fs.writeFile(archivePath, compressed)
    const stats = await fs.stat(archivePath)
    return statToSummary(filename, stats)
  } catch (error) {
    await safeRemove(archivePath)
    throw error
  }
}

export async function getBackupFile(filename: string) {
  const archivePath = resolveManagedBackupPath(filename)
  if (!(await fileExists(archivePath))) {
    throw new HttpError(404, 'Backup file not found.')
  }
  return archivePath
}

export async function restoreBackup(filename: string) {
  await ensureBackupDirs()

  const archivePath = resolveManagedBackupPath(filename)
  if (!(await fileExists(archivePath))) {
    throw new HttpError(404, 'Backup file not found.')
  }

  const extractDir = path.join(TEMP_ROOT, `restore-${Date.now()}`)
  const rollbackUploadsDir = path.join(TEMP_ROOT, `rollback-uploads-${Date.now()}`)

  await fs.mkdir(extractDir, { recursive: true })
  try {
    const compressed = await fs.readFile(archivePath)
    const snapshot = JSON.parse((await gunzipAsync(compressed)).toString('utf8')) as BackupSnapshot
    const payload = snapshot.database

    const hadUploads = await fileExists(uploadsRoot)
    if (hadUploads) {
      await safeRemove(rollbackUploadsDir)
      await fs.cp(uploadsRoot, rollbackUploadsDir, { recursive: true })
    }

    try {
      await importDatabase(payload)

      await safeRemove(uploadsRoot)
      await fs.mkdir(uploadsRoot, { recursive: true })
      await writeUploadFiles(snapshot.uploads ?? [])
    } catch (error) {
      if (await fileExists(rollbackUploadsDir)) {
        await safeRemove(uploadsRoot)
        await fs.cp(rollbackUploadsDir, uploadsRoot, { recursive: true })
      }
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backup restore failed.'
    throw new HttpError(500, message)
  } finally {
    await safeRemove(extractDir)
    await safeRemove(rollbackUploadsDir)
  }
}
