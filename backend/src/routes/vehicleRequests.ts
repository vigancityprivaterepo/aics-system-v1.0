import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { logAdminAudit } from '../services/adminAuditService.js'
import { generateVehicleRequestDocx } from '../services/vehicleRequestDocumentService.js'
import { currencyFromDb } from '../utils/currency.js'

const router = Router()
const VEHICLE_TYPES = ['city_coaster', 'city_bus', 'manlift', 'truck', 'van', 'ambulance', 'other'] as const
const AVAILABILITY = ['pending', 'available', 'unavailable'] as const
const STATUS = ['draft', 'processed'] as const

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
  status: z.enum(STATUS).default('draft'),
}).refine((data) => data.vehicleType !== 'other' || Boolean(data.otherVehicle), { path: ['otherVehicle'], message: 'Specify the requested vehicle.' })
  .refine((data) => data.arrivalDate >= data.departureDate, { path: ['arrivalDate'], message: 'Arrival date cannot be before departure.' })

function serialize(row: any) {
  return { ...row, driverPerDiem: currencyFromDb(row.driverPerDiem), rentalFees: currencyFromDb(row.rentalFees), tollFees: currencyFromDb(row.tollFees), otherFees: currencyFromDb(row.otherFees), fuelExpenses: currencyFromDb(row.fuelExpenses) }
}

router.get('/options', asyncHandler(async (_req, res) => {
  const rows = await prisma.vehicleRequest.findMany({ select: { office: true, address: true, purpose: true, destination: true }, orderBy: { updatedAt: 'desc' }, take: 500 })
  const unique = (field: keyof typeof rows[number]) => [...new Set(rows.map((row) => row[field]).filter(Boolean))].slice(0, 50)
  res.json({ offices: unique('office'), addresses: unique('address'), purposes: unique('purpose'), destinations: unique('destination') })
}))

router.get('/', asyncHandler(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const status = typeof req.query.status === 'string' && STATUS.includes(req.query.status as any) ? req.query.status : undefined
  const requests = await prisma.vehicleRequest.findMany({
    where: { ...(status ? { status } : {}), ...(search ? { OR: [
      { requestNumber: { contains: search, mode: 'insensitive' } }, { requestedBy: { contains: search, mode: 'insensitive' } },
      { office: { contains: search, mode: 'insensitive' } }, { destination: { contains: search, mode: 'insensitive' } },
    ] } : {}) }, include: { createdBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 250,
  })
  res.json({ requests: requests.map(serialize) })
}))

router.post('/', asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized')
  const body = requestSchema.parse(req.body)
  const sequence = await prisma.$queryRawUnsafe<Array<{ seq: bigint }>>(`SELECT nextval('vehicle_request_number_seq') AS seq`)
  const requestNumber = `VR-${body.requestDate.getFullYear()}-${String(sequence[0].seq).padStart(5, '0')}`
  const created = await prisma.vehicleRequest.create({ data: { ...body, requestNumber, createdById: req.user.id } })
  await logAdminAudit(prisma, { actorId: req.user.id, action: 'vehicle_request.create', targetType: 'vehicle_request', targetId: created.id, summary: `Created vehicle request ${requestNumber}` })
  res.status(201).json(serialize(created))
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const row = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) }, include: { createdBy: { select: { id: true, name: true } } } })
  if (!row) throw new HttpError(404, 'Vehicle request not found.')
  res.json(serialize(row))
}))

router.put('/:id', asyncHandler(async (req, res) => {
  const body = requestSchema.parse(req.body)
  const updated = await prisma.vehicleRequest.update({ where: { id: String(req.params.id) }, data: body })
  await logAdminAudit(prisma, { actorId: req.user?.id, action: 'vehicle_request.update', targetType: 'vehicle_request', targetId: updated.id, summary: `Updated vehicle request ${updated.requestNumber}` })
  res.json(serialize(updated))
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const removed = await prisma.vehicleRequest.delete({ where: { id: String(req.params.id) } })
  await logAdminAudit(prisma, { actorId: req.user?.id, action: 'vehicle_request.delete', targetType: 'vehicle_request', targetId: removed.id, summary: `Deleted vehicle request ${removed.requestNumber}` })
  res.status(204).send()
}))

router.get('/:id/document', asyncHandler(async (req, res) => {
  const row = await prisma.vehicleRequest.findUnique({ where: { id: String(req.params.id) } })
  if (!row) throw new HttpError(404, 'Vehicle request not found.')
  const buffer = generateVehicleRequestDocx(row)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${row.requestNumber}-vehicle-request.docx"`)
  res.setHeader('Content-Length', String(buffer.length))
  res.send(buffer)
}))

export default router