import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'

const router = Router()

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
  unitPrice: z.union([z.number(), z.string()]),
})

router.post('/bulk-import', csvUpload.single('file'), asyncHandler(async (req, res) => {
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

  type MedicineRow = { genericName: string; brandName: string | null; unit: string | null; strength: string | null; category: string | null; unitPrice: number }
  const toInsert: MedicineRow[] = []
  let skipped = 0

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const genericName = r[iGeneric]?.trim() ?? ''
    // Skip blank rows, purely-numeric rows (row numbers), or header-like repeats
    if (!genericName || /^\d+$/.test(genericName)) { skipped++; continue }

    const brandName  = (r[iBrand]?.trim()    || null)?.slice(0, 200) ?? null
    const category   = (r[iCategory]?.trim() || null)?.slice(0, 100) ?? null
    const unit       = (r[iStrength]?.trim() || null)?.slice(0, 50)  ?? null   // Strength / Concentration → unit
    const strength   = (r[iDosage]?.trim()   || null)?.slice(0, 50)  ?? null   // Dosage Form → strength

    toInsert.push({ genericName: genericName.slice(0, 200), brandName, unit, strength, category, unitPrice: 0 })
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

  const result = await prisma.medicineItem.createMany({ data: newRows })

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

  const where = {
    ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
    ...(search
      ? {
        OR: [
          { genericName: { contains: search, mode: 'insensitive' as const } },
          { brandName: { contains: search, mode: 'insensitive' as const } },
        ],
      }
      : {}),
  }

  const [total, medicines] = await Promise.all([
    prisma.medicineItem.count({ where }),
    prisma.medicineItem.findMany({
      where,
      orderBy: [{ genericName: 'asc' }, { brandName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

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
      createdAt: m.createdAt,
    })),
  })
}))

router.post('/', asyncHandler(async (req, res) => {
  const body = medicineSchema.parse(req.body)

  const created = await prisma.medicineItem.create({
    data: {
      genericName: body.genericName,
      brandName: body.brandName ?? null,
      unit: body.unit ?? null,
      strength: body.strength ?? null,
      category: body.category ?? null,
      unitPrice: Number(body.unitPrice),
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
  })
}))

router.put('/:id', asyncHandler(async (req, res) => {
  const medicineId = paramId(req.params.id)
  const body = medicineSchema.parse(req.body)

  const existing = await prisma.medicineItem.findUnique({ where: { id: medicineId } })
  if (!existing) throw new HttpError(404, 'Medicine not found')

  const updated = await prisma.medicineItem.update({
    where: { id: medicineId },
    data: {
      genericName: body.genericName,
      brandName: body.brandName ?? null,
      unit: body.unit ?? null,
      strength: body.strength ?? null,
      category: body.category ?? null,
      unitPrice: Number(body.unitPrice),
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
  })
}))

router.delete('/', asyncHandler(async (req, res) => {
  const result = await prisma.medicineItem.deleteMany({})
  res.json({ deleted: result.count })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const medicineId = paramId(req.params.id)
  const existing = await prisma.medicineItem.findUnique({ where: { id: medicineId } })
  if (!existing) throw new HttpError(404, 'Medicine not found')

  await prisma.medicineItem.delete({ where: { id: medicineId } })
  res.status(204).send()
}))

export default router