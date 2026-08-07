import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireRole } from '../middleware/auth.js'

const router = Router()
const adminOnly = requireRole(['admin'])
const canManageMedicine = requireRole(['admin', 'city_health_office'])

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Minimal RFC-4180-compatible CSV parser
function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^﻿/, '') // strip BOM
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { field += c }
    } else {
      if (c === '"') { inQuotes = true }
      else if (c === ',') { row.push(field.trim()); field = '' }
      else if (c === '\r' || c === '\n') {
        if (c === '\r' && next === '\n') i++
        row.push(field.trim())
        if (row.some(f => f)) rows.push(row)
        row = []; field = ''
      } else { field += c }
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(f => f)) rows.push(row) }
  return rows
}


function cleanOptionalText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  if (['\u00e2\u20ac\u201d', '\u00e2\u20ac\u201c', '\u2014', '\u2013'].includes(normalized)) return null
  return normalized.slice(0, maxLength)
}

function paramId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const medicineSchema = z.object({
  genericName: z.string().min(1),
  brandName: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  unitPrice: z.union([z.number(), z.string()]).optional().nullable(),
  isAvailable: z.boolean().optional().default(true),
})

// Same identity the catalog is actually keyed on in practice: generic name + strength/conc.
// + dosage form (brand name is informational, not part of what makes two entries "the same
// medicine" here — the Add/Edit form doesn't even collect it for new entries).
async function findDuplicateMedicine(
  genericName: string,
  unit: string | null,
  strength: string | null,
  excludeId?: string,
) {
  return prisma.medicineItem.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      genericName: { equals: genericName, mode: 'insensitive' },
      unit: unit ? { equals: unit, mode: 'insensitive' } : null,
      strength: strength ? { equals: strength, mode: 'insensitive' } : null,
    },
  })
}

function buildAvailabilityTimestamps(isAvailable: boolean, occurredAt = new Date()) {
  return isAvailable
    ? {
        availabilityUpdatedAt: occurredAt,
        availableUpdatedAt: occurredAt,
      }
    : {
        availabilityUpdatedAt: occurredAt,
        unavailableUpdatedAt: occurredAt,
      }
}

router.post('/bulk-import', adminOnly, csvUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded')

  const text = req.file.buffer.toString('utf-8')
  const rows = parseCsv(text)
  if (rows.length < 2) throw new HttpError(400, 'CSV file has no data rows')

  // Find header row (handles spreadsheets with title rows above the actual header)
  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const normalized = rows[i].map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
    if (normalized.some(h => h === 'genericname' || h.startsWith('generic'))) {
      headerIdx = i
      break
    }
  }

  const headers = rows[headerIdx].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const col = (keys: string[]): number => {
    for (const k of keys) {
      const idx = headers.findIndex(h => h.includes(k))
      if (idx >= 0) return idx
    }
    return -1
  }

  // Column index resolution with positional fallbacks
  const iGeneric   = col(['genericname', 'generic'])   >= 0 ? col(['genericname', 'generic'])   : 1
  const iBrand     = col(['brandname', 'brand'])        >= 0 ? col(['brandname', 'brand'])        : 2
  const iCategory  = col(['drugcategory', 'category'])  >= 0 ? col(['drugcategory', 'category'])  : 4
  const iDosage    = col(['dosageform', 'dosage'])      >= 0 ? col(['dosageform', 'dosage'])      : 5
  const iStrength  = col(['strengthconcentration', 'strength', 'concentration']) >= 0
    ? col(['strengthconcentration', 'strength', 'concentration']) : 6

  type MedicineRow = { genericName: string; brandName: string | null; unit: string | null; strength: string | null; category: string | null; unitPrice: number; isAvailable: boolean }
  const toInsert: MedicineRow[] = []
  let skipped = 0

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const genericName = r[iGeneric]?.trim() ?? ''
    // Skip blank rows, purely-numeric rows (row numbers), or header-like repeats
    if (!genericName || /^\d+$/.test(genericName)) { skipped++; continue }

    const brandName  = cleanOptionalText(r[iBrand], 200)
    const category   = cleanOptionalText(r[iCategory], 100)
    const unit       = cleanOptionalText(r[iStrength], 50)   // Strength / Concentration -> unit
    const strength   = cleanOptionalText(r[iDosage], 50)     // Dosage Form -> strength

    toInsert.push({ genericName: genericName.slice(0, 200), brandName, unit, strength, category, unitPrice: 0, isAvailable: true })
  }

  if (toInsert.length === 0) throw new HttpError(400, 'No valid medicine rows found in CSV')

  // Build a key for each CSV row to compare against existing records
  const makeKey = (genericName: string, brandName: string | null, unit: string | null, strength: string | null) =>
    `${genericName.toLowerCase()}|${(brandName ?? '').toLowerCase()}|${(unit ?? '').toLowerCase()}|${(strength ?? '').toLowerCase()}`

  const existing = await prisma.medicineItem.findMany({
    select: { genericName: true, brandName: true, unit: true, strength: true },
  })
  const existingKeys = new Set(existing.map(m => makeKey(m.genericName, m.brandName, m.unit, m.strength)))

  const newRows = toInsert.filter(r => !existingKeys.has(makeKey(r.genericName, r.brandName, r.unit, r.strength)))
  const duplicates = toInsert.length - newRows.length

  if (newRows.length === 0) {
    return res.status(200).json({ imported: 0, skipped, duplicates, message: 'All rows already exist — nothing new to import.' })
  }

  const importTimestamp = new Date()
  const result = await prisma.medicineItem.createMany({
    data: newRows.map((row) => ({
      ...row,
      ...buildAvailabilityTimestamps(row.isAvailable, importTimestamp),
    })),
  })

  res.status(201).json({ imported: result.count, skipped, duplicates })
}))

router.get('/categories', asyncHandler(async (req, res) => {
  const rows = await prisma.medicineItem.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  const categories = rows.map(r => r.category).filter(Boolean) as string[]
  res.json({ categories })
}))

router.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim()
  const category = String(req.query.category ?? '').trim()
  const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  const buildWhere = (s: string) => ({
    ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
    ...(s
      ? {
        OR: [
          { genericName: { contains: s, mode: 'insensitive' as const } },
          { brandName: { contains: s, mode: 'insensitive' as const } },
        ],
      }
      : {}),
  })

  let where = buildWhere(search)
  let [total, medicines] = await Promise.all([
    prisma.medicineItem.count({ where }),
    prisma.medicineItem.findMany({
      where,
      orderBy: [{ genericName: 'asc' }, { brandName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  if (total === 0 && search.length > 4) {
    const fallbackSearch = search.slice(0, Math.min(6, search.length - 1))
    where = buildWhere(fallbackSearch)
    const [fbTotal, fbMedicines] = await Promise.all([
      prisma.medicineItem.count({ where }),
      prisma.medicineItem.findMany({
        where,
        orderBy: [{ genericName: 'asc' }, { brandName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    if (fbTotal > 0) {
      total = fbTotal
      medicines = fbMedicines
    }
  }

  res.json({
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    medicines: medicines.map((m) => ({
      id: m.id,
      genericName: m.genericName,
      brandName: m.brandName,
      unit: m.unit,
      strength: m.strength,
      category: m.category,
      unitPrice: Number(m.unitPrice),
      isAvailable: (m as any).isAvailable ?? true,
      availabilityUpdatedAt: (m as any).availabilityUpdatedAt ?? m.updatedAt,
      availableUpdatedAt: (m as any).availableUpdatedAt ?? ((m as any).isAvailable ?? true ? ((m as any).availabilityUpdatedAt ?? m.updatedAt) : null),
      unavailableUpdatedAt: (m as any).unavailableUpdatedAt ?? ((m as any).isAvailable === false ? ((m as any).availabilityUpdatedAt ?? m.updatedAt) : null),
      createdAt: m.createdAt,
    })),
  })
}))

router.post('/', canManageMedicine, asyncHandler(async (req, res) => {
  const body = medicineSchema.parse(req.body)
  const unit = cleanOptionalText(body.unit, 50)
  const strength = cleanOptionalText(body.strength, 50)

  const duplicate = await findDuplicateMedicine(body.genericName, unit, strength)
  if (duplicate) {
    throw new HttpError(409, `"${duplicate.genericName}"${unit ? ` (${unit})` : ''}${strength ? ` — ${strength}` : ''} already exists in the database.`)
  }

  const created = await prisma.medicineItem.create({
    data: {
      genericName: body.genericName,
      brandName: cleanOptionalText(body.brandName, 200),
      unit,
      strength,
      category: cleanOptionalText(body.category, 100),
      unitPrice: Number(body.unitPrice ?? 0),
      isAvailable: body.isAvailable ?? true,
      ...buildAvailabilityTimestamps(body.isAvailable ?? true),
    },
  })

  res.status(201).json({
    id: created.id,
    genericName: created.genericName,
    brandName: created.brandName,
    unit: created.unit,
    strength: created.strength,
    category: created.category,
    unitPrice: Number(created.unitPrice),
    isAvailable: (created as any).isAvailable ?? true,
    availabilityUpdatedAt: (created as any).availabilityUpdatedAt ?? created.updatedAt,
    availableUpdatedAt: (created as any).availableUpdatedAt ?? ((created as any).isAvailable ?? true ? ((created as any).availabilityUpdatedAt ?? created.updatedAt) : null),
    unavailableUpdatedAt: (created as any).unavailableUpdatedAt ?? ((created as any).isAvailable === false ? ((created as any).availabilityUpdatedAt ?? created.updatedAt) : null),
  })
}))

router.put('/:id', canManageMedicine, asyncHandler(async (req, res) => {
  const medicineId = paramId(req.params.id)
  const body = medicineSchema.parse(req.body)

  const existing = await prisma.medicineItem.findUnique({ where: { id: medicineId } })
  if (!existing) throw new HttpError(404, 'Medicine not found')
  const nextIsAvailable = body.isAvailable ?? (existing as any).isAvailable ?? true
  const didAvailabilityChange = nextIsAvailable !== ((existing as any).isAvailable ?? true)

  const unit = cleanOptionalText(body.unit, 50)
  const strength = cleanOptionalText(body.strength, 50)
  const duplicate = await findDuplicateMedicine(body.genericName, unit, strength, medicineId)
  if (duplicate) {
    throw new HttpError(409, `"${duplicate.genericName}"${unit ? ` (${unit})` : ''}${strength ? ` — ${strength}` : ''} already exists in the database.`)
  }

  const updated = await prisma.medicineItem.update({
    where: { id: medicineId },
    data: {
      genericName: body.genericName,
      brandName: cleanOptionalText(body.brandName, 200),
      unit,
      strength,
      category: cleanOptionalText(body.category, 100),
      unitPrice: Number(body.unitPrice ?? existing.unitPrice),
      isAvailable: nextIsAvailable,
      ...(didAvailabilityChange
        ? buildAvailabilityTimestamps(nextIsAvailable)
        : {}),
    },
  })

  res.json({
    id: updated.id,
    genericName: updated.genericName,
    brandName: updated.brandName,
    unit: updated.unit,
    strength: updated.strength,
    category: updated.category,
    unitPrice: Number(updated.unitPrice),
    isAvailable: (updated as any).isAvailable ?? true,
    availabilityUpdatedAt: (updated as any).availabilityUpdatedAt ?? updated.updatedAt,
    availableUpdatedAt: (updated as any).availableUpdatedAt ?? ((updated as any).isAvailable ?? true ? ((updated as any).availabilityUpdatedAt ?? updated.updatedAt) : null),
    unavailableUpdatedAt: (updated as any).unavailableUpdatedAt ?? ((updated as any).isAvailable === false ? ((updated as any).availabilityUpdatedAt ?? updated.updatedAt) : null),
  })
}))

router.patch('/:id/availability', canManageMedicine, asyncHandler(async (req, res) => {
  const medicineId = paramId(req.params.id)
  const schema = z.object({ isAvailable: z.boolean() })
  const { isAvailable } = schema.parse(req.body)

  const existing = await prisma.medicineItem.findUnique({ where: { id: medicineId } })
  if (!existing) throw new HttpError(404, 'Medicine not found')

  const updated = await prisma.medicineItem.update({
    where: { id: medicineId },
    data: { isAvailable, ...buildAvailabilityTimestamps(isAvailable) },
  })

  res.json({
    id: updated.id,
    genericName: updated.genericName,
    isAvailable: (updated as any).isAvailable ?? true,
    availabilityUpdatedAt: (updated as any).availabilityUpdatedAt ?? updated.updatedAt,
    availableUpdatedAt: (updated as any).availableUpdatedAt ?? ((updated as any).isAvailable ?? true ? ((updated as any).availabilityUpdatedAt ?? updated.updatedAt) : null),
    unavailableUpdatedAt: (updated as any).unavailableUpdatedAt ?? ((updated as any).isAvailable === false ? ((updated as any).availabilityUpdatedAt ?? updated.updatedAt) : null),
  })
}))

router.delete('/', adminOnly, asyncHandler(async (req, res) => {
  const result = await prisma.medicineItem.deleteMany({})
  res.json({ deleted: result.count })
}))

router.delete('/:id', canManageMedicine, asyncHandler(async (req, res) => {
  const medicineId = paramId(req.params.id)
  const existing = await prisma.medicineItem.findUnique({ where: { id: medicineId } })
  if (!existing) throw new HttpError(404, 'Medicine not found')

  await prisma.medicineItem.delete({ where: { id: medicineId } })
  res.status(204).send()
}))

export default router
