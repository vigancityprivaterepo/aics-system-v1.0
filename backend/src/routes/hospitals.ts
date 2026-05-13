import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'

const router = Router()

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Minimal RFC-4180-compatible CSV parser (shared pattern)
function parseCsv(raw: string): string[][] {
  const text = raw.replace(/^﻿/, '')
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

const hospitalSchema = z.object({
  province:     z.string().min(1),
  municipality: z.string().min(1),
  facilityName: z.string().min(1),
  facilityType: z.string().min(1),
  fullAddress:  z.string().optional().nullable(),
})

// POST /hospitals/bulk-import
router.post('/bulk-import', csvUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded')

  const text = req.file.buffer.toString('utf-8')
  const rows = parseCsv(text)
  if (rows.length < 2) throw new HttpError(400, 'CSV file has no data rows')

  // Find header row
  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const normalized = rows[i].map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
    if (normalized.some(h => h.includes('province') || h.includes('facility'))) {
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

  // CSV columns: Province | City / Municipality | Facility Name | Facility Type | Full Address
  const iProvince     = col(['province'])                       >= 0 ? col(['province'])                       : 0
  const iMunicipality = col(['city', 'municipality', 'citymun']) >= 0 ? col(['city', 'municipality', 'citymun']) : 1
  const iFacilityName = col(['facilityname', 'facility'])       >= 0 ? col(['facilityname', 'facility'])       : 2
  const iFacilityType = col(['facilitytype', 'type'])           >= 0 ? col(['facilitytype', 'type'])           : 3
  const iFullAddress  = col(['fulladdress', 'address'])         >= 0 ? col(['fulladdress', 'address'])         : 4

  type FacilityRow = { province: string; municipality: string; facilityName: string; facilityType: string; fullAddress: string | null }
  const toInsert: FacilityRow[] = []
  let skipped = 0

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const facilityName = r[iFacilityName]?.trim() ?? ''
    if (!facilityName || /^\d+$/.test(facilityName)) { skipped++; continue }

    const province     = (r[iProvince]?.trim()     || '').slice(0, 100)
    const municipality = (r[iMunicipality]?.trim() || '').slice(0, 100)
    const facilityType = (r[iFacilityType]?.trim() || '').slice(0, 100)
    const fullAddress  = (r[iFullAddress]?.trim()  || null)

    toInsert.push({ province, municipality, facilityName: facilityName.slice(0, 300), facilityType, fullAddress })
  }

  if (toInsert.length === 0) throw new HttpError(400, 'No valid hospital rows found in CSV')

  const makeKey = (r: FacilityRow) =>
    `${r.facilityName.toLowerCase()}|${r.municipality.toLowerCase()}|${r.province.toLowerCase()}`

  const existing = await prisma.hospitalFacility.findMany({
    select: { facilityName: true, municipality: true, province: true },
  })
  const existingKeys = new Set(existing.map(h => makeKey({ ...h, facilityType: '', fullAddress: null })))

  const newRows = toInsert.filter(r => !existingKeys.has(makeKey(r)))
  const duplicates = toInsert.length - newRows.length

  if (newRows.length === 0) {
    return res.status(200).json({ imported: 0, skipped, duplicates, message: 'All rows already exist — nothing new to import.' })
  }

  const result = await prisma.hospitalFacility.createMany({ data: newRows })
  res.status(201).json({ imported: result.count, skipped, duplicates })
}))

// GET /hospitals/types
router.get('/types', asyncHandler(async (req, res) => {
  const rows = await prisma.hospitalFacility.findMany({
    select: { facilityType: true },
    distinct: ['facilityType'],
    orderBy: { facilityType: 'asc' },
  })
  res.json({ types: rows.map(r => r.facilityType).filter(Boolean) })
}))

// GET /hospitals
router.get('/', asyncHandler(async (req, res) => {
  const search       = String(req.query.search ?? '').trim()
  const facilityType = String(req.query.type ?? '').trim()
  const province     = String(req.query.province ?? '').trim()
  const limit        = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100)
  const page         = Math.max(Number(req.query.page ?? 1), 1)

  const where = {
    ...(facilityType ? { facilityType: { equals: facilityType, mode: 'insensitive' as const } } : {}),
    ...(province     ? { province:     { equals: province,     mode: 'insensitive' as const } } : {}),
    ...(search
      ? {
        OR: [
          { facilityName: { contains: search, mode: 'insensitive' as const } },
          { municipality: { contains: search, mode: 'insensitive' as const } },
          { fullAddress:  { contains: search, mode: 'insensitive' as const } },
        ],
      }
      : {}),
  }

  const [total, facilities] = await Promise.all([
    prisma.hospitalFacility.count({ where }),
    prisma.hospitalFacility.findMany({
      where,
      orderBy: [{ province: 'asc' }, { municipality: 'asc' }, { facilityName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    facilities: facilities.map(h => ({
      id:           h.id,
      province:     h.province,
      municipality: h.municipality,
      facilityName: h.facilityName,
      facilityType: h.facilityType,
      fullAddress:  h.fullAddress,
      createdAt:    h.createdAt,
    })),
  })
}))

// POST /hospitals
router.post('/', asyncHandler(async (req, res) => {
  const body = hospitalSchema.parse(req.body)
  const created = await prisma.hospitalFacility.create({ data: body })
  res.status(201).json(created)
}))

// PUT /hospitals/:id
router.put('/:id', asyncHandler(async (req, res) => {
  const id = paramId(req.params.id)
  const body = hospitalSchema.parse(req.body)
  const existing = await prisma.hospitalFacility.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Hospital facility not found')
  const updated = await prisma.hospitalFacility.update({ where: { id }, data: body })
  res.json(updated)
}))

// DELETE /hospitals  (delete all)
router.delete('/', asyncHandler(async (req, res) => {
  const result = await prisma.hospitalFacility.deleteMany({})
  res.json({ deleted: result.count })
}))

// DELETE /hospitals/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = paramId(req.params.id)
  const existing = await prisma.hospitalFacility.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Hospital facility not found')
  await prisma.hospitalFacility.delete({ where: { id } })
  res.status(204).send()
}))

export default router
