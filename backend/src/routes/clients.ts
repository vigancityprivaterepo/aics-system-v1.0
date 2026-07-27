import { Router } from 'express'
import { z } from 'zod'
import { ClientCategory, Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { generateClientCaseNumber } from '../utils/caseNumber.js'
import { HttpError } from '../utils/httpError.js'
import { requireRole } from '../middleware/auth.js'
import { buildPersonMatchInput, duplicateConflict, findClientDuplicateMatches, mergeClientRecords, recordClientDedupEvent } from '../services/clientDedupService.js'

const router = Router()

function paramId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const createClientSchema = z.object({
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  sex: z.string().optional().nullable(),
  civilStatus: z.string().optional().nullable(),
  barangay: z.string().optional().nullable(),
  municipality: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  is4ps: z.boolean().optional(),
  isPwd: z.boolean().optional(),
  isSenior: z.boolean().optional(),
  clientCategory: z.enum(['walk-in', 'referred', 'rescued']).optional(),
  referralSource: z.string().optional().nullable(),
  familyComposition: z.array(z.record(z.any())).optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  reuseClientId: z.string().uuid().optional().nullable(),
  overrideDuplicateReason: z.string().trim().min(3).max(500).optional().nullable(),
})

const updateClientSchema = createClientSchema.partial()
const duplicateCheckSchema = createClientSchema.omit({ reuseClientId: true, overrideDuplicateReason: true })
const mergeClientSchema = z.object({
  targetClientId: z.string().uuid(),
  notes: z.string().trim().min(3).max(500).optional().nullable(),
})

function normalizeRfidUid(value: string | null | undefined): string | null {
  const uid = String(value ?? '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '')
  return uid.length > 0 ? uid : null
}

function toClientCategory(value?: string | null): ClientCategory {
  if (value === 'referred') return ClientCategory.referred
  if (value === 'rescued') return ClientCategory.rescued
  return ClientCategory.walk_in
}

type ClientDTO = {
  id: string
  caseNumber: string
  lastName: string
  firstName: string
  middleName: string | null
  dateOfBirth: Date | null
  sex: string | null
  civilStatus: string | null
  barangay: string | null
  municipality: string | null
  province: string | null
  region: string | null
  contactNumber: string | null
  occupation: string | null
  religion: string | null
  is4ps: boolean
  isPwd: boolean
  isSenior: boolean
  clientCategory: ClientCategory
  referralSource: string | null
  familyComposition?: unknown
  photoUrl: string | null
  rfidUid?: string | null
  mergedIntoClientId?: string | null
  createdAt: Date
  updatedAt: Date
}

function serializeClient(client: ClientDTO) {
  return {
    id: client.id,
    caseNumber: client.caseNumber,
    lastName: client.lastName,
    firstName: client.firstName,
    middleName: client.middleName,
    dateOfBirth: client.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    sex: client.sex,
    civilStatus: client.civilStatus,
    barangay: client.barangay,
    municipality: client.municipality,
    province: client.province,
    region: client.region,
    contactNumber: client.contactNumber,
    occupation: client.occupation,
    religion: client.religion,
    is4ps: client.is4ps,
    isPwd: client.isPwd,
    isSenior: client.isSenior,
    clientCategory: client.clientCategory.replace('_', '-'),
    referralSource: client.referralSource,
    familyComposition: Array.isArray((client as any).familyComposition) ? (client as any).familyComposition : [],
    photoUrl: client.photoUrl,
    rfidUid: (client as any).rfidUid ?? null,
    mergedIntoClientId: (client as any).mergedIntoClientId ?? null,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim()
  const limit = Math.min(Number(req.query.limit ?? 15), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  const where = search
    ? {
      mergedIntoClientId: null,
      OR: [
        { caseNumber: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { middleName: { contains: search, mode: 'insensitive' as const } },
        { barangay: { contains: search, mode: 'insensitive' as const } },
        { municipality: { contains: search, mode: 'insensitive' as const } },
        { province: { contains: search, mode: 'insensitive' as const } },
      ],
    }
    : { mergedIntoClientId: null }

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        cases: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { caseNumber: true },
        },
      },
    }),
  ])

  res.json({
    total,
    page,
    limit,
    clients: clients.map((c) => ({
      ...serializeClient(c),
      latestCaseNumber: (c as any).cases?.[0]?.caseNumber ?? null,
    })),
  })
}))

router.post('/duplicate-check', asyncHandler(async (req, res) => {
  const body = duplicateCheckSchema.parse(req.body)
  const result = await findClientDuplicateMatches(prisma, buildPersonMatchInput({
    firstName: body.firstName,
    lastName: body.lastName,
    middleName: body.middleName,
    dateOfBirth: body.dateOfBirth,
    sex: body.sex,
    contactNumber: body.contactNumber,
    barangay: body.barangay,
    municipality: body.municipality,
    province: body.province,
  }))

  res.json(result)
}))

router.post('/', asyncHandler(async (req, res) => {
  const body = createClientSchema.parse(req.body)

  if (body.reuseClientId) {
    const existing = await prisma.client.findFirst({
      where: { id: body.reuseClientId, mergedIntoClientId: null },
    })
    if (!existing) throw new HttpError(404, 'Selected existing client was not found.')

    await recordClientDedupEvent(prisma, {
      actorId: req.user?.id ?? null,
      targetClientId: existing.id,
      action: 'manual_reuse_existing_client',
      notes: body.overrideDuplicateReason ?? 'Staff reused an existing client profile during intake.',
      payload: {
        formFirstName: body.firstName,
        formLastName: body.lastName,
        formDateOfBirth: body.dateOfBirth ?? null,
      },
    })

    return res.status(200).json({ ...serializeClient(existing), reusedExisting: true })
  }

  const duplicateResult = await findClientDuplicateMatches(prisma, buildPersonMatchInput({
    firstName: body.firstName,
    lastName: body.lastName,
    middleName: body.middleName,
    dateOfBirth: body.dateOfBirth,
    sex: body.sex,
    contactNumber: body.contactNumber,
    barangay: body.barangay,
    municipality: body.municipality,
    province: body.province,
  }))

  if (duplicateResult.duplicateStatus !== 'no_match' && !body.overrideDuplicateReason) {
    throw duplicateConflict('Possible duplicate client found. Review the existing profile before creating a new one.', duplicateResult)
  }

  const caseNumber = await generateClientCaseNumber()

  const client = await prisma.client.create({
    data: {
      caseNumber,
      lastName: body.lastName,
      firstName: body.firstName,
      middleName: body.middleName ?? null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      sex: body.sex ?? null,
      civilStatus: body.civilStatus ?? null,
      barangay: body.barangay ?? null,
      municipality: body.municipality ?? null,
      province: body.province ?? null,
      region: body.region ?? null,
      contactNumber: body.contactNumber ?? null,
      occupation: body.occupation ?? null,
      religion: body.religion ?? null,
      is4ps: body.is4ps ?? false,
      isPwd: body.isPwd ?? false,
      isSenior: body.isSenior ?? false,
      clientCategory: toClientCategory(body.clientCategory),
      referralSource: body.referralSource ?? null,
      familyComposition: body.familyComposition ?? undefined,
      photoUrl: body.photoUrl ?? null,
    },
  })

  if (body.overrideDuplicateReason) {
    await recordClientDedupEvent(prisma, {
      actorId: req.user?.id ?? null,
      sourceClientId: client.id,
      action: 'manual_create_override',
      notes: body.overrideDuplicateReason,
      payload: {
        duplicateStatus: duplicateResult.duplicateStatus,
        matches: duplicateResult.matches.map((match) => ({ id: match.id, score: match.score })),
      },
    })
  }

  res.status(201).json(serializeClient(client))
}))

// RFID Lookup

router.get('/rfid/:uid', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, max-age=0')

  const uid = normalizeRfidUid(paramId(req.params.uid))
  if (!uid) throw new HttpError(400, 'RFID UID is required')

  const client = await prisma.client.findFirst({
    where: { rfidUid: uid, mergedIntoClientId: null },
    include: {
      cases: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          caseNumber: true,
          assistanceType: true,
          status: true,
          amount: true,
          dateOfAssessment: true,
          createdAt: true,
          medicines: { select: { medicineName: true } },
          burialDetails: { select: { funeralHome: true, typeOfBill: true, deceasedName: true } },
          hospitalDetails: { select: { hospitalName: true, patientName: true } },
          medicalDetails: { select: { clinicName: true, doctorName: true } },
          eyeglassDetails: { select: { clinicName: true, doctorName: true } },
          plainDetails: { select: { natureOfAssistance: true } },
        },
      },
    },
  })

  if (!client) throw new HttpError(404, 'No client is enrolled with this RFID card')

  res.json({
    ...serializeClient(client),
    history: client.cases.map((c) => ({
      id: c.id,
      caseNumber: (c as any).caseNumber ?? null,
      assistanceType: c.assistanceType,
      status: c.status,
      amount: Number(c.amount ?? 0),
      dateOfAssessment: c.dateOfAssessment?.toISOString().slice(0, 10) ?? null,
      createdAt: c.createdAt,
      detail: {
        medicines: (c as any).medicines?.map((m: any) => m.medicineName) ?? [],
        funeralHome: (c as any).burialDetails?.funeralHome ?? null,
        typeOfBill: (c as any).burialDetails?.typeOfBill ?? null,
        deceasedName: (c as any).burialDetails?.deceasedName ?? null,
        hospitalName: (c as any).hospitalDetails?.hospitalName ?? null,
        clinicName: (c as any).medicalDetails?.clinicName ?? (c as any).eyeglassDetails?.clinicName ?? null,
        doctorName: (c as any).medicalDetails?.doctorName ?? (c as any).eyeglassDetails?.doctorName ?? null,
        natureOfAssistance: (c as any).plainDetails?.natureOfAssistance ?? null,
      },
    })),
  })
}))

// RFID Enroll / Remove

const rfidUpdateSchema = z.object({
  rfidUid: z.string().trim().min(4).max(96).nullable(),
})

router.patch('/:id/rfid', asyncHandler(async (req, res) => {
  const clientId = paramId(req.params.id)
  const parsed = rfidUpdateSchema.parse(req.body)
  const rfidUid = normalizeRfidUid(parsed.rfidUid)

  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new HttpError(404, 'Client not found')

  // If assigning a UID, check it isn't already used by another client
  if (rfidUid !== null) {
    const conflict = await prisma.client.findFirst({
      where: { rfidUid, id: { not: clientId } },
      select: { id: true, firstName: true, lastName: true, caseNumber: true },
    })
    if (conflict) {
      throw new HttpError(
        409,
        `This RFID card is already enrolled to ${conflict.lastName}, ${conflict.firstName} (${conflict.caseNumber}). Remove it there first.`
      )
    }
  }

  const updated = await (prisma.client as any).update({
    where: { id: clientId },
    data: { rfidUid },
  })

  res.json(serializeClient(updated))
}))

// Get single client by ID

router.get('/:id', asyncHandler(async (req, res) => {
  const clientId = paramId(req.params.id)
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      mergedIntoClient: {
        select: {
          id: true,
          caseNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      cases: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          caseNumber: true,
          assistanceType: true,
          status: true,
          amount: true,
          dateOfAssessment: true,
          createdAt: true,
          medicines: { select: { medicineName: true } },
          burialDetails: { select: { funeralHome: true, typeOfBill: true, deceasedName: true } },
          hospitalDetails: { select: { hospitalName: true, patientName: true } },
          medicalDetails: { select: { clinicName: true, doctorName: true } },
          eyeglassDetails: { select: { clinicName: true, doctorName: true } },
          plainDetails: { select: { natureOfAssistance: true } },
        },
      },
    },
  })

  if (!client) throw new HttpError(404, 'Client not found')

  res.json({
    ...serializeClient(client),
    mergedIntoClient: client.mergedIntoClient
      ? {
          id: client.mergedIntoClient.id,
          caseNumber: client.mergedIntoClient.caseNumber,
          firstName: client.mergedIntoClient.firstName,
          lastName: client.mergedIntoClient.lastName,
        }
      : null,
    history: client.cases.map((c) => ({
      id: c.id,
      caseNumber: (c as any).caseNumber ?? null,
      assistanceType: c.assistanceType,
      status: c.status,
      amount: Number(c.amount ?? 0),
      dateOfAssessment: c.dateOfAssessment?.toISOString().slice(0, 10) ?? null,
      createdAt: c.createdAt,
      detail: {
        medicines: (c as any).medicines?.map((m: any) => m.medicineName) ?? [],
        funeralHome: (c as any).burialDetails?.funeralHome ?? null,
        typeOfBill: (c as any).burialDetails?.typeOfBill ?? null,
        deceasedName: (c as any).burialDetails?.deceasedName ?? null,
        hospitalName: (c as any).hospitalDetails?.hospitalName ?? null,
        clinicName: (c as any).medicalDetails?.clinicName ?? (c as any).eyeglassDetails?.clinicName ?? null,
        doctorName: (c as any).medicalDetails?.doctorName ?? (c as any).eyeglassDetails?.doctorName ?? null,
        natureOfAssistance: (c as any).plainDetails?.natureOfAssistance ?? null,
      },
    })),
  })
}))

router.put('/:id', requireRole(['admin']), asyncHandler(async (req, res) => {
  const clientId = paramId(req.params.id)
  const body = updateClientSchema.parse(req.body)

  const current = await prisma.client.findUnique({ where: { id: clientId } })
  if (!current) throw new HttpError(404, 'Client not found')

  const duplicateResult = await findClientDuplicateMatches(prisma, buildPersonMatchInput({
    firstName: body.firstName ?? current.firstName,
    lastName: body.lastName ?? current.lastName,
    middleName: body.middleName ?? current.middleName,
    dateOfBirth:
      body.dateOfBirth === null
        ? null
        : (body.dateOfBirth ?? current.dateOfBirth),
    sex: body.sex ?? current.sex,
    contactNumber: body.contactNumber ?? current.contactNumber,
    barangay: body.barangay ?? current.barangay,
    municipality: body.municipality ?? current.municipality,
    province: body.province ?? current.province,
  }), { excludeClientId: clientId })

  if (duplicateResult.duplicateStatus !== 'no_match' && !body.overrideDuplicateReason) {
    throw duplicateConflict('This update would make the client look like an existing profile. Review the possible duplicate first.', duplicateResult)
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      lastName: body.lastName,
      firstName: body.firstName,
      middleName: body.middleName,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : body.dateOfBirth === null ? null : undefined,
      sex: body.sex,
      civilStatus: body.civilStatus,
      barangay: body.barangay,
      municipality: body.municipality,
      province: body.province,
      region: body.region,
      contactNumber: body.contactNumber,
      occupation: body.occupation,
      religion: body.religion,
      is4ps: body.is4ps,
      isPwd: body.isPwd,
      isSenior: body.isSenior,
      clientCategory: body.clientCategory ? toClientCategory(body.clientCategory) : undefined,
      referralSource: body.referralSource,
      familyComposition: body.familyComposition === null ? Prisma.JsonNull : body.familyComposition,
      photoUrl: body.photoUrl,
    },
  })

  if (body.overrideDuplicateReason) {
    await recordClientDedupEvent(prisma, {
      actorId: req.user?.id ?? null,
      sourceClientId: updated.id,
      action: 'manual_update_override',
      notes: body.overrideDuplicateReason,
      payload: {
        duplicateStatus: duplicateResult.duplicateStatus,
        matches: duplicateResult.matches.map((match) => ({ id: match.id, score: match.score })),
      },
    })
  }

  res.json(serializeClient(updated))
}))

router.post('/:id/merge', requireRole(['admin']), asyncHandler(async (req, res) => {
  const sourceClientId = paramId(req.params.id)
  const body = mergeClientSchema.parse(req.body)

  const merged = await prisma.$transaction((tx) => mergeClientRecords(tx, {
    sourceClientId,
    targetClientId: body.targetClientId,
    actorId: req.user?.id ?? null,
    notes: body.notes ?? null,
    payload: { initiatedFrom: 'client_profile' },
  }))

  if (!merged) throw new HttpError(404, 'Target client not found')
  res.json({ id: merged.id, caseNumber: merged.caseNumber })
}))

router.delete('/:id', requireRole(['admin']), asyncHandler(async (req, res) => {
  const clientId = paramId(req.params.id)
  const client = await prisma.client.findUnique({ where: { id: clientId } })
  if (!client) throw new HttpError(404, 'Client not found')
  await prisma.case.deleteMany({ where: { clientId } })
  await prisma.client.delete({ where: { id: clientId } })
  res.status(204).send()
}))

export default router
