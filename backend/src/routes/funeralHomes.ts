import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requireRole } from '../middleware/auth.js'

const router = Router()
const adminOnly = requireRole(['admin'])
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

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

function paramId(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

const funeralHomeSchema = z.object({
  name: z.string().min(1).max(200),
  ownerName: z.string().max(200).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
})

function cleanOptionalText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return null
  if (['â€”', '—', '–'].includes(normalized)) return null
  return normalized.slice(0, maxLength)
}

// POST /funeral-homes/bulk-import
router.post('/bulk-import', adminOnly, csvUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'No file uploaded')

  const text = req.file.buffer.toString('utf-8')
  const rows = parseCsv(text)
  if (rows.length < 2) throw new HttpError(400, 'CSV file has no data rows')

  // Auto-detect header row
  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const normalized = rows[i].map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
    if (normalized.some(h => h.includes('funeral') || h.includes('name') || h.includes('home'))) {
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

  // CSV columns: Funeral Home | Owner (optional) | Address (optional)
  const iName      = col(['funeral', 'name', 'home']) >= 0 ? col(['funeral', 'name', 'home']) : 0
  const iOwnerName = col(['owner', 'manager'])
  const iAddress   = col(['address', 'addr'])          >= 0 ? col(['address', 'addr'])          : (iOwnerName >= 0 ? 2 : 1)

  type HomeRow = { name: string; ownerName: string | null; address: string | null }
  const toInsert: HomeRow[] = []
  let skipped = 0

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const name = r[iName]?.trim() ?? ''
    if (!name || /^\d+$/.test(name)) { skipped++; continue }
    const ownerName = iOwnerName >= 0 ? cleanOptionalText(r[iOwnerName], 200) : null
    const address   = iAddress   >= 0 ? cleanOptionalText(r[iAddress], 300) : null
    toInsert.push({ name: name.slice(0, 200), ownerName, address })
  }

  if (toInsert.length === 0) throw new HttpError(400, 'No valid funeral home rows found in CSV')

  const existing = await prisma.funeralHome.findMany({ select: { name: true } })
  const existingKeys = new Set(existing.map(h => h.name.toLowerCase()))

  const newRows = toInsert.filter(r => !existingKeys.has(r.name.toLowerCase()))
  const duplicates = toInsert.length - newRows.length

  if (newRows.length === 0) {
    return res.status(200).json({ imported: 0, skipped, duplicates, message: 'All rows already exist — nothing new to import.' })
  }

  const result = await prisma.funeralHome.createMany({ data: newRows })
  res.status(201).json({ imported: result.count, skipped, duplicates })
}))

// DELETE /funeral-homes  (delete all) — must be before /:id
router.delete('/', adminOnly, asyncHandler(async (_req, res) => {
  const result = await prisma.funeralHome.deleteMany({})
  res.json({ deleted: result.count })
}))

// GET /funeral-homes
router.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim()
  const limit  = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100)
  const page   = Math.max(Number(req.query.page ?? 1), 1)

  const where = search
    ? {
        OR: [
          { name:    { contains: search, mode: 'insensitive' as const } },
          { address: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, homes] = await Promise.all([
    prisma.funeralHome.count({ where }),
    prisma.funeralHome.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    funeralHomes: homes.map((home) => ({
      ...home,
      ownerName: cleanOptionalText(home.ownerName, 200),
      address: cleanOptionalText(home.address, 300),
    })),
  })
}))

// POST /funeral-homes
router.post('/', adminOnly, asyncHandler(async (req, res) => {
  const body = funeralHomeSchema.parse(req.body)
  const home = await prisma.funeralHome.create({
    data: {
      name: body.name,
      ownerName: cleanOptionalText(body.ownerName, 200),
      address: cleanOptionalText(body.address, 300),
    },
  })
  res.status(201).json(home)
}))

// PUT /funeral-homes/:id
router.put('/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = paramId(req.params.id)
  const body = funeralHomeSchema.parse(req.body)
  const existing = await prisma.funeralHome.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Funeral home not found')
  const home = await prisma.funeralHome.update({
    where: { id },
    data: {
      name: body.name,
      ownerName: cleanOptionalText(body.ownerName, 200),
      address: cleanOptionalText(body.address, 300),
    },
  })
  res.json(home)
}))

// DELETE /funeral-homes/:id
router.delete('/:id', adminOnly, asyncHandler(async (req, res) => {
  const id = paramId(req.params.id)
  const existing = await prisma.funeralHome.findUnique({ where: { id } })
  if (!existing) throw new HttpError(404, 'Funeral home not found')
  await prisma.funeralHome.delete({ where: { id } })
  res.status(204).send()
}))

export default router
