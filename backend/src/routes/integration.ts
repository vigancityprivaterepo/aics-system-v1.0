import express, { Router } from 'express'
import { Prisma } from '@prisma/client'
import { getAbsoluteFSPath } from 'swagger-ui-dist'
import { z } from 'zod'
import { integrationOpenApi } from '../integration/openapi.js'
import { requireIntegrationEnabled, requireIntegrationKey } from '../middleware/integrationAuth.js'
import { softRateLimit } from '../middleware/softRateLimit.js'
import { isSameAsClientName } from '../serializers/caseSerializer.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { logger } from '../utils/logger.js'
import { prisma } from '../utils/prisma.js'

// Integration API v1: a read-only bridge other City systems pull from (first
// caller: the Unified Central Record Management System). The contract is
// integration/openapi.ts, shown at /api/integration/v1/docs.
//
// It gives out identity, address, program flags, family composition and
// released assistance. It never gives out diagnosis, medicines, hospital
// details, case study narrative, photos, contact numbers or RFID numbers:
// add a field here only with the Data Protection Officer's agreement.

const router = Router()

router.use(requireIntegrationEnabled)

// --- Contract and Swagger UI (no key needed: the contract holds no data) -----

router.get('/openapi.json', (_req, res) => {
  res.json(integrationOpenApi)
})

// Replaces the package's own initializer (which loads a demo API) and is a
// file of its own, not an inline script, so the default helmet CSP allows it.
router.get('/docs/swagger-initializer.js', (_req, res) => {
  res.type('application/javascript').send(`window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: '../openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'StandaloneLayout',
    persistAuthorization: false,
  })
}
`)
})
router.use('/docs', express.static(getAbsoluteFSPath()))

// --- Data ----------------------------------------------------------------------

router.use(requireIntegrationKey)
router.use(softRateLimit({
  scope: 'integration',
  windowMs: 60_000,
  maxAttempts: 240,
  cooldownMs: 30_000,
  key: (req) => req.integrationKeyName,
  message: 'Too many requests',
}))

const pageQuerySchema = z.object({
  updatedSince: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})
type PageQuery = z.infer<typeof pageQuerySchema>

// A cursor is the (updated_at, id) of the last row of the previous page.
// updated_at travels as Postgres wrote it, microseconds included, so a page
// boundary never repeats or skips a row.
function encodeCursor(row: { ts: string; id: string }) {
  return Buffer.from(JSON.stringify([row.ts, row.id])).toString('base64url')
}

function decodeCursor(cursor: string | undefined): { ts: string; id: string } | null {
  if (!cursor) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && z.string().uuid().safeParse(parsed[1]).success && !Number.isNaN(Date.parse(parsed[0]))) {
      return { ts: parsed[0], id: parsed[1] as string }
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Validation failed', { issues: [{ path: 'cursor', message: 'Not a cursor returned by this API' }] })
}

// The ids of one page, oldest change first, plus the cursor for the next page.
async function pageOfIds(table: 'clients' | 'cases', condition: Prisma.Sql, query: PageQuery) {
  const after = decodeCursor(query.cursor)
  const rows = await prisma.$queryRaw<Array<{ id: string; ts: string }>>(Prisma.sql`
    SELECT t.id, t.updated_at::text AS ts
    FROM ${Prisma.raw(table)} t
    WHERE ${condition}
      ${query.updatedSince ? Prisma.sql`AND t.updated_at >= ${new Date(query.updatedSince)}` : Prisma.empty}
      ${after ? Prisma.sql`AND (t.updated_at, t.id) > (${after.ts}::timestamptz, ${after.id}::uuid)` : Prisma.empty}
    ORDER BY t.updated_at, t.id
    LIMIT ${query.limit + 1}`)
  const page = rows.slice(0, query.limit)
  const last = page[page.length - 1]
  return { ids: page.map((row) => row.id), nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null }
}

function inOrder<T extends { id: string }>(ids: string[], rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.map((id) => byId.get(id)).filter((row): row is T => row !== undefined)
}

// Every call is kept in the admin audit log: which system, what, how much.
async function recordCall(req: express.Request, what: string, count: number, query?: PageQuery) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        action: 'integration.read',
        targetType: 'integration',
        targetId: req.integrationKeyName ?? null,
        summary: `${req.integrationKeyName ?? 'unknown'} read ${count} ${what}`,
        details: { path: req.path, count, updatedSince: query?.updatedSince ?? null, ip: req.ip ?? null },
      },
    })
  } catch (error) {
    logger.withError('Could not record an integration call', error, { path: req.path })
  }
}

const text = (value: unknown): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}
const day = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null)

// Family composition is free-form JSON typed by case makers: keep the lines
// that name someone, and only the fields of the contract (no monthly income,
// no RFID).
function familyMembers(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const member = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
    const name = text(member.name)
    if (!name) return []
    const age = Number.parseInt(String(member.age ?? ''), 10)
    const relationship = text(member.relationship)
    return [{
      name,
      age: Number.isInteger(age) && age >= 0 && age <= 130 ? age : null,
      relationship: relationship?.toLowerCase() === 'others' ? text(member.relationshipOther) ?? relationship : relationship,
      sex: text(member.sex),
      occupation: text(member.occupation),
    }]
  })
}

const clientSelect = {
  id: true,
  caseNumber: true,
  lastName: true,
  firstName: true,
  middleName: true,
  dateOfBirth: true,
  sex: true,
  civilStatus: true,
  barangay: true,
  municipality: true,
  province: true,
  occupation: true,
  is4ps: true,
  isPwd: true,
  isSenior: true,
  isSoloParent: true,
  familyComposition: true,
  mergedIntoClientId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect

function toClient(client: Prisma.ClientGetPayload<{ select: typeof clientSelect }>) {
  return {
    id: client.id,
    clientNumber: client.caseNumber,
    lastName: client.lastName,
    firstName: client.firstName,
    middleName: text(client.middleName),
    dateOfBirth: day(client.dateOfBirth),
    sex: text(client.sex),
    civilStatus: text(client.civilStatus),
    barangay: text(client.barangay),
    municipality: text(client.municipality),
    province: text(client.province),
    occupation: text(client.occupation),
    is4ps: client.is4ps,
    isPwd: client.isPwd,
    isSenior: client.isSenior,
    isSoloParent: client.isSoloParent,
    familyMembers: familyMembers(client.familyComposition),
    mergedIntoClientId: client.mergedIntoClientId,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  }
}

router.get('/ping', asyncHandler(async (req, res) => {
  res.json({ status: 'ok', keyName: req.integrationKeyName, serverTime: new Date().toISOString() })
}))

router.get('/clients', asyncHandler(async (req, res) => {
  const query = pageQuerySchema.parse(req.query)
  const { ids, nextCursor } = await pageOfIds('clients', Prisma.sql`TRUE`, query)
  const clients = await prisma.client.findMany({ where: { id: { in: ids } }, select: clientSelect })
  const items = inOrder(ids, clients).map(toClient)
  await recordCall(req, 'clients', items.length, query)
  res.json({ items, nextCursor })
}))

router.get('/clients/:clientId', asyncHandler(async (req, res) => {
  const clientId = z.string().uuid().safeParse(req.params.clientId)
  const client = clientId.success ? await prisma.client.findUnique({ where: { id: clientId.data }, select: clientSelect }) : null
  if (!client) throw new HttpError(404, 'Client not found')
  await recordCall(req, 'client', 1)
  res.json(toClient(client))
}))

// A case counts once it has reached 'released', even if it was archived or
// cancelled afterwards: the caller is then told to withdraw its copy.
const EVER_RELEASED = Prisma.sql`(t.status = 'released' OR EXISTS (
  SELECT 1 FROM case_status_logs l WHERE l.case_id = t.id AND l.to_status = 'released'))`

router.get('/releases', asyncHandler(async (req, res) => {
  const query = pageQuerySchema.parse(req.query)
  const { ids, nextCursor } = await pageOfIds('cases', EVER_RELEASED, query)
  const [cases, releasedLogs] = await Promise.all([
    prisma.case.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        caseNumber: true,
        clientId: true,
        assistanceType: true,
        status: true,
        amount: true,
        isArchived: true,
        beneficiaryName: true,
        beneficiaryRequestorRelationship: true,
        updatedAt: true,
        client: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.caseStatusLog.groupBy({ by: ['caseId'], where: { caseId: { in: ids }, toStatus: 'released' }, _max: { changedAt: true } }),
  ])
  const releasedAt = new Map(releasedLogs.map((log) => [log.caseId, log._max.changedAt]))

  const items = inOrder(ids, cases).map((row) => {
    const beneficiaryName = text(row.beneficiaryName)
    const beneficiaryIsClient = !beneficiaryName || isSameAsClientName(beneficiaryName, row.client)
    return {
      id: row.id,
      caseNumber: row.caseNumber,
      clientId: row.clientId,
      assistanceType: row.assistanceType,
      amount: row.amount === null ? null : Number(row.amount),
      releasedAt: (releasedAt.get(row.id) ?? row.updatedAt).toISOString(),
      beneficiaryIsClient,
      beneficiaryName: beneficiaryIsClient ? null : beneficiaryName,
      beneficiaryRelationship: beneficiaryIsClient ? null : text(row.beneficiaryRequestorRelationship),
      withdrawn: row.isArchived || row.status !== 'released',
      updatedAt: row.updatedAt.toISOString(),
    }
  })
  await recordCall(req, 'releases', items.length, query)
  res.json({ items, nextCursor })
}))

export default router
