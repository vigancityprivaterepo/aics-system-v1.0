import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { logAdminAudit } from '../services/adminAuditService.js'
import { generateVehicleRequestDocx } from '../services/vehicleRequestDocumentService.js'
import { currencyFromDb } from '../utils/currency.js'
import { buildConversionBasename, convertDocxBufferToHtml } from '../services/officeConversionService.js'

const router = Router()
const VEHICLE_TYPES = ['city_coaster', 'city_bus', 'manlift', 'truck', 'van', 'ambulance', 'other'] as const
const AVAILABILITY = ['pending', 'available', 'unavailable'] as const
const STATUS = ['draft', 'pending_admin', 'approved', 'processed', 'pending_cho_review', 'cho_reviewed'] as const

const requestSchema = z.object({
  vehicleType: z.enum(VEHICLE_TYPES), otherVehicle: z.string().trim().max(150).nullable().optional(),
  requestDate: z.coerce.date(), requestedBy: z.string().trim().min(1).max(200),
  office: z.string().trim().min(1).max(200), address: z.string().trim().min(1).max(300),
  purpose: z.string().trim().min(1).max(3000), destination: z.string().trim().min(1).max(300),
  departureDate: z.coerce.date(), departureTime: z.string().trim().min(1).max(20),
  arrivalDate: z.coerce.date(), arrivalTime: z.string().trim().min(1).max(20),
  numberOfPassengers: z.coerce.number().int().min(1).max(999), availability: z.enum(AVAILABILITY).default('pending'),
  vehicleModel: z.string().trim().max(150).nullable().optional(), unavailableReason: z.string().trim().max(2000).nullable().optional(),
  plateNumber: z.string().trim().max(50).nullable().optional(), alternativeVehicle: z.string().trim().max(150).nullable().optional(),
  alternativeModel: z.string().trim().max(150).nullable().optional(), alternativePlate: z.string().trim().max(50).nullable().optional(),
  driverPerDiem: z.coerce.number().min(0).default(0), rentalFees: z.coerce.number().min(0).default(0),
  tollFees: z.coerce.number().min(0).default(0), otherFees: z.coerce.number().min(0).default(0),
  fuelExpenses: z.coerce.number().min(0).default(0), remarks: z.string().trim().max(3000).nullable().optional(),
  status: z.enum(STATUS).default('pending_admin'),
}).refine((data) => data.vehicleType !== 'other' || Boolean(data.otherVehicle), { path: ['otherVehicle'], message: 'Specify the requested vehicle.' })
  .refine((data) => data.arrivalDate >= data.departureDate, { path: ['arrivalDate'], message: 'Arrival date cannot be before departure.' })

const choReviewSchema = z.object({
  availability: z.enum(['available', 'unavailable']),
  vehicleModel: z.string().trim().max(150).nullable().optional(),
  unavailableReason: z.string().trim().max(2000).nullable().optional(),
  plateNumber: z.string().trim().max(50).nullable().optional(),
  alternativeVehicle: z.string().trim().max(150).nullable().optional(),
  alternativeModel: z.string().trim().max(150).nullable().optional(),
  alternativePlate: z.string().trim().max(50).nullable().optional(),
  remarks: z.string().trim().max(3000).nullable().optional(),
}).refine((data) => data.availability !== 'unavailable' || Boolean(data.unavailableReason), {
  path: ['unavailableReason'], message: 'Provide the reason the ambulance is unavailable.',
})

function isCho(req: any) {
  return req.user?.role === 'city_health_office'
}

function assertChoCanView(req: any, row: any) {
  if (isCho(req) && row.vehicleType !== 'ambulance') throw new HttpError(403, 'City Health Office can only access ambulance requests.')
}

async function mayorSignatureUrl() {
  const mayor = await prisma.user.findFirst({
    where: { isActive: true, position: { contains: 'Mayor', mode: 'insensitive' } },
    select: { eSignatureUrl: true },
    orderBy: { name: 'asc' },
  })
  return mayor?.eSignatureUrl ?? null
}

function serialize(row: any) {
  return {
    ...row,
    driverPerDiem: currencyFromDb(row.driverPerDiem), rentalFees: currencyFromDb(row.rentalFees),
    tollFees: currencyFromDb(row.tollFees), otherFees: currencyFromDb(row.otherFees), fuelExpenses: currencyFromDb(row.fuelExpenses),
  }
}

router.get('/options', asyncHandler(async (req, res) => {
  const rows = await prisma.vehicleRequest.findMany({
    where: isCho(req) ? { createdById: req.user?.id } : undefined,
    select: { office: true, address: true, purpose: true, destination: true }, orderBy: { updatedAt: 'desc' }, take: 500,
  })
  const unique = (field: keyof typeof rows[number]) => [...new Set(rows.map((row) => row[field]).filter(Boolean))].slice(0, 50)
  res.json({ offices: unique('office'), addresses: unique('address'), purposes: unique('purpose'), destinations: unique('destination') })
}))

router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const status = typeof req.query.status === 'string' && STATUS.includes(req.query.status as any) ? req.query.status : undefined
  const requests = await prisma.vehicleRequest.findMany({
    where: {
      ...(isCho(req) ? { createdById: req.user?.id } : {}),
      ...(status ? { status } : {}),
      ...(search ? { OR: [
        { requestNumber: { contains: search, mode: 'insensitive' } }, { requestedBy: { contains: search, mode: 'insensitive' } },
        { office: { contains: search, mode: 'insensitive' } }, { destination: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    },
    include: { createdBy: { select: { id: true, name: true } }, choReviewedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }, take: 250,
  })
  res.json({ requests: requests.map(serialize) })
}))

router.post('/', asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized')
  if (!isCho(req)) throw new HttpError(403, 'Only City Health Office users can create vehicle requests.')
  const body = requestSchema.parse(req.body)
  const sequence = await prisma.$queryRawUnsafe<Array<{ seq: bigint }>>(`SELECT nextval('vehicle_request_number_seq') AS seq`)
  const requestNumber = `VR-${body.requestDate.getFullYear()}-${String(sequence[0].seq).padStart(5, '0')}`
  const created = await prisma.vehicleRequest.create({
    data: { ...body, vehicleType: 'ambulance', requestNumber, status: 'pending_admin', createdById: req.user.id },
  })
  await logAdminAudit(prisma, { actorId: req.user.id, action: 'vehicle_request.create', targetType: 'vehicle_request', targetId: created.id, summary: `CHO created vehicle request ${requestNumber} for administrative approval` })
  res.status(201).json(serialize(created))
}))

router.patch('/:id/approve', asyncHandler(async (req, res) => {
  if (!req.user || isCho(req)) throw new HttpError(403, 'Only administrative employees can approve CHO vehicle requests.')
  const current = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!current) throw new HttpError(404, 'Vehicle request not found.')
  if (current.status === 'approved') throw new HttpError(400, 'Vehicle request is already approved.')
  const updated = await prisma.vehicleRequest.update({
    where: { id: current.id },
    data: {
      status: 'approved',
      choReviewedById: req.user.id,
      choReviewedByName: req.user.name,
      choReviewedAt: new Date(),
    },
    include: { createdBy: { select: { id: true, name: true } }, choReviewedBy: { select: { id: true, name: true } } },
  })
  await logAdminAudit(prisma, {
    actorId: req.user.id,
    action: 'vehicle_request.approve',
    targetType: 'vehicle_request',
    targetId: updated.id,
    summary: `Administrative employee approved ${updated.requestNumber}`,
  })
  res.json(serialize(updated))
}))

router.patch('/:id/cho-review', asyncHandler(async (req, res) => {
  if (!req.user || !['admin', 'city_health_office'].includes(req.user.role)) throw new HttpError(403, 'Only City Health Office can review ambulance availability.')
  const body = choReviewSchema.parse(req.body)
  const current = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!current) throw new HttpError(404, 'Vehicle request not found.')
  if (current.vehicleType !== 'ambulance') throw new HttpError(400, 'CHO review is only available for ambulance requests.')
  const updated = await prisma.vehicleRequest.update({
    where: { id: current.id },
    data: {
      ...body,
      status: 'cho_reviewed',
      choReviewedById: req.user.id,
      choReviewedByName: req.user.name,
      choReviewedAt: new Date(),
    },
    include: { createdBy: { select: { id: true, name: true } }, choReviewedBy: { select: { id: true, name: true } } },
  })
  await logAdminAudit(prisma, {
    actorId: req.user.id, action: 'vehicle_request.cho_review', targetType: 'vehicle_request', targetId: updated.id,
    summary: `CHO marked ${updated.requestNumber} as ${body.availability}`,
  })
  res.json(serialize(updated))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) }, include: { createdBy: { select: { id: true, name: true } }, choReviewedBy: { select: { id: true, name: true } } } })
  if (!row) throw new HttpError(404, 'Vehicle request not found.')
  assertChoCanView(req, row)
  res.json(serialize(row))
}))

router.put('/:id', asyncHandler(async (req, res) => {
  if (!isCho(req)) throw new HttpError(403, 'Only administrative employees can edit approved request records.')
  const body = requestSchema.parse(req.body)
  const current = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!current) throw new HttpError(404, 'Vehicle request not found.')
  const isAdmin = !isCho(req)
  const workflowData = isAdmin
    ? {}
    : {
        availability: current.availability, status: current.status, vehicleModel: current.vehicleModel,
        unavailableReason: current.unavailableReason, plateNumber: current.plateNumber,
        alternativeVehicle: current.alternativeVehicle, alternativeModel: current.alternativeModel, alternativePlate: current.alternativePlate,
      }
  const updated = await prisma.vehicleRequest.update({ where: { id: current.id }, data: { ...body, ...workflowData } })
  await logAdminAudit(prisma, { actorId: req.user?.id, action: 'vehicle_request.update', targetType: 'vehicle_request', targetId: updated.id, summary: `Updated vehicle request ${updated.requestNumber}` })
  res.json(serialize(updated))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!isCho(req)) throw new HttpError(403, 'Only the CHO request maker can delete a pending request.')
  const existing = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!existing || existing.createdById !== req.user?.id || existing.status === 'approved') throw new HttpError(403, 'Only your own pending CHO request can be deleted.')
  const removed = await prisma.vehicleRequest.delete({ where: { id: String(req.params.id) } })
  await logAdminAudit(prisma, { actorId: req.user?.id, action: 'vehicle_request.delete', targetType: 'vehicle_request', targetId: removed.id, summary: `Deleted vehicle request ${removed.requestNumber}` })
  res.status(204).send()
}))

router.get('/:id/document', asyncHandler(async (req, res) => {
  const row = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!row) throw new HttpError(404, 'Vehicle request not found.')
  assertChoCanView(req, row)
  const isApproved = row.status === 'approved' || row.status === 'processed'
  const sigUrl = isApproved ? await mayorSignatureUrl() : null
  const buffer = generateVehicleRequestDocx(row, sigUrl)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${row.requestNumber}-vehicle-request.docx"`)
  res.setHeader('Content-Length', String(buffer.length))
  res.send(buffer)
}))

router.get('/:id/document/html', asyncHandler(async (req, res) => {
  const row = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!row) throw new HttpError(404, 'Vehicle request not found.')
  assertChoCanView(req, row)
  const isApproved = row.status === 'approved' || row.status === 'processed'
  const sigUrl = isApproved ? await mayorSignatureUrl() : null
  const buffer = generateVehicleRequestDocx(row, sigUrl)
  const html = await convertDocxBufferToHtml(buffer, buildConversionBasename(`${row.requestNumber}-vehicle-request`))
  if (!html) throw new HttpError(503, 'LibreOffice HTML preview is not available.')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.send(html)
}))

export default router
