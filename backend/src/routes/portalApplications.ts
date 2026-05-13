import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { ApplicantApplicationStatus, AssistanceType } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { requirePortalAuth } from '../middleware/portalAuth.js'
import { generateGuaranteeLetterPdfForCase, loadGuaranteeLetterCase } from '../services/guaranteeLetterService.js'
import { portalApplicationsDirectory } from '../services/storageService.js'
import { removeStoredUpload, validateStoredUpload } from '../services/uploadValidation.js'
import { backendRoot } from '../utils/paths.js'

const router = Router()

const uploadDir = portalApplicationsDirectory()

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      cb(null, `${Date.now()}-${safeOriginal}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const assistanceTypes = ['medicine', 'burial', 'hospital', 'medical', 'eyeglass', 'plain'] as const

const applicationSchema = z.object({
  assistanceType: z.enum(assistanceTypes),
  contactNumber: z.string().trim().min(1, 'Contact number is required'),
  hospitalFacilityId: z.string().trim().optional().nullable(),
  medicineItemId: z.string().trim().optional().nullable(),
  medicineItemIds: z.array(z.string().trim().min(1)).optional().default([]),
  reason: z.string().trim().min(1, 'Reason for assistance is required'),
  householdMembers: z.array(z.object({
    name: z.string().min(1),
    relationship: z.string().min(1),
    age: z.union([z.number(), z.string()]).optional().nullable(),
    occupation: z.string().optional().nullable(),
  })).optional().default([]),
  metadata: z.record(z.any()).optional().default({}),
})

const notificationsReadSchema = z.object({
  notifications: z.array(z.object({
    id: z.string().min(1),
    applicationId: z.string().uuid(),
  })).min(1),
  read: z.boolean().default(true),
})

function getApplicationMetadata(application: any) {
  return typeof application.metadata === 'object' && application.metadata && !Array.isArray(application.metadata)
    ? application.metadata
    : {}
}

function getReadNotificationIds(application: any): string[] {
  const metadata = getApplicationMetadata(application)
  const value = metadata.portalReadNotifications
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function serializeApplication(application: any) {
  const metadata = getApplicationMetadata(application)
  const guaranteeLetterSupported = ['burial', 'hospital', 'medical'].includes(application.assistanceType)

  return {
    id: application.id,
    applicantId: application.applicantId,
    assistanceType: application.assistanceType,
    status: application.status,
    referenceNumber: application.referenceNumber,
    contactNumber: application.contactNumber,
    reason: application.reason,
    householdMembers: application.householdMembers ?? [],
    metadata,
    submittedAt: application.submittedAt,
    reviewedAt: application.reviewedAt,
    adminNotes: application.adminNotes,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    linkedCase: application.case
      ? {
          id: application.case.id,
          caseNumber: application.case.caseNumber ?? null,
          status: application.case.status,
          guaranteeLetterAvailable: guaranteeLetterSupported && ['approved', 'released'].includes(application.case.status),
          guaranteeLetterPortalUrl:
            guaranteeLetterSupported && ['approved', 'released'].includes(application.case.status)
              ? `/api/portal/applications/${application.id}/guarantee-letter/pdf`
              : null,
          updatedAt: application.case.updatedAt,
          approvals: (application.case.approvals ?? []).map((a: any) => ({
            stage: a.stage,
            action: a.action,
            actedByName: a.actedByName,
            actedByTitle: a.actedByTitle ?? null,
            actedAt: a.actedAt,
          })),
        }
      : null,
    documents: (application.documents ?? []).map((doc: any) => ({
      id: doc.id,
      documentType: doc.documentType,
      originalName: doc.originalName,
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      uploadedAt: doc.uploadedAt,
    })),
  }
}

const CASE_NOTIFICATION_STATUSES = ['for_review', 'recommending_approval', 'for_approval', 'approved', 'released'] as const

const caseNotificationMeta: Record<string, { title: string; message: (referenceNumber: string, assistanceType: string) => string }> = {
  for_review: {
    title: 'Case For Review',
    message: (referenceNumber, assistanceType) =>
      `Your ${assistanceType} assistance request ${referenceNumber} is now under social welfare review.`,
  },
  recommending_approval: {
    title: 'Case For Recommending Approval',
    message: (referenceNumber, assistanceType) =>
      `Your ${assistanceType} assistance request ${referenceNumber} has advanced to recommending approval.`,
  },
  for_approval: {
    title: 'Case For Final Approval',
    message: (referenceNumber, assistanceType) =>
      `Your ${assistanceType} assistance request ${referenceNumber} is now awaiting final approval.`,
  },
  approved: {
    title: 'Case Approved',
    message: (referenceNumber, assistanceType) =>
      `Your ${assistanceType} assistance request ${referenceNumber} has been approved by the office.`,
  },
  released: {
    title: 'Assistance Released',
    message: (referenceNumber, assistanceType) =>
      `Your ${assistanceType} assistance request ${referenceNumber} has been marked as released by the office.`,
  },
}

function serializeCaseStatusNotification(application: any, log: any) {
  const referenceNumber = application.referenceNumber || 'Draft application'
  const status = String(log.toStatus || '').trim()
  const meta = caseNotificationMeta[status] || {
    title: 'Case Status Updated',
    message: (ref: string, assistance: string) => `Your ${assistance} assistance request ${ref} has a new status update.`,
  }

  return {
    id: `case-log-${log.id}`,
    type: 'case_status_update',
    status,
    title: meta.title,
    message: meta.message(referenceNumber, application.assistanceType),
    applicationId: application.id,
    referenceNumber,
    assistanceType: application.assistanceType,
    createdAt: log.changedAt,
    notes: log.notes ?? null,
    linkedCase: application.case
      ? {
          id: application.case.id,
          caseNumber: application.case.caseNumber ?? null,
          status: application.case.status,
        }
      : null,
    read: getReadNotificationIds(application).includes(`case-log-${log.id}`),
  }
}

function serializeResubmissionNotification(application: any) {
  const referenceNumber = application.referenceNumber || 'Draft application'

  return {
    id: `resubmission-${application.id}`,
    type: 'resubmission_required',
    status: 'resubmission_required',
    title: 'Resubmission Required',
    message: `Your ${application.assistanceType} assistance request ${referenceNumber} requires additional or corrected documents before review can continue.`,
    applicationId: application.id,
    referenceNumber,
    assistanceType: application.assistanceType,
    createdAt: application.reviewedAt ?? application.updatedAt,
    notes: application.adminNotes ?? null,
    linkedCase: application.case
      ? {
          id: application.case.id,
          caseNumber: application.case.caseNumber ?? null,
          status: application.case.status,
        }
      : null,
    read: getReadNotificationIds(application).includes(`resubmission-${application.id}`),
  }
}

function serializeApprovedNotification(application: any) {
  const referenceNumber = application.referenceNumber || 'Draft application'

  return {
    id: `approved-${application.id}`,
    type: 'application_approved',
    status: 'approved',
    title: 'Application Approved',
    message: `Your application ${referenceNumber} has been approved. You can come to the municipal hall admin office at any convenient time for document passing.`,
    applicationId: application.id,
    referenceNumber,
    assistanceType: application.assistanceType,
    createdAt: application.reviewedAt ?? application.updatedAt,
    notes: application.adminNotes ?? null,
    linkedCase: application.case
      ? {
          id: application.case.id,
          caseNumber: application.case.caseNumber ?? null,
          status: application.case.status,
        }
      : null,
    read: getReadNotificationIds(application).includes(`approved-${application.id}`),
  }
}


async function ensureApplicant(req: any) {
  const applicant = await prisma.applicant.findUnique({
    where: { id: req.applicant!.id },
  })
  if (!applicant) throw new HttpError(404, 'Account not found')
  return applicant
}

function getIncompleteApplicantProfileFields(applicant: any) {
  const requiredFields: Array<[string, unknown]> = [
    ['first name', applicant.firstName],
    ['last name', applicant.lastName],
    ['mobile number', applicant.mobileNumber],
    ['date of birth', applicant.dateOfBirth],
    ['sex', applicant.sex],
    ['civil status', applicant.civilStatus],
    ['barangay', applicant.barangay],
    ['municipality', applicant.municipality],
    ['province', applicant.province],
    ['region', applicant.region],
    ['occupation', applicant.occupation],
    ['religion', applicant.religion],
  ]

  return requiredFields
    .filter(([, value]) => (typeof value === 'string' ? !value.trim() : !value))
    .map(([label]) => label)
}

function assertApplicantProfileComplete(applicant: any) {
  const missingFields = getIncompleteApplicantProfileFields(applicant)
  if (!missingFields.length) return

  throw new HttpError(
    400,
    `Complete your profile before filing an application. Missing: ${missingFields.join(', ')}.`,
  )
}

async function assertOwnership(applicationId: string, applicantId: string) {
  const application = await prisma.applicantApplication.findFirst({
    where: { id: applicationId, applicantId },
    include: { documents: true },
  })
  if (!application) throw new HttpError(404, 'Application not found')
  return application
}

function isApplicantEditableStatus(application: any) {
  return application.status === ApplicantApplicationStatus.draft || application.status === ApplicantApplicationStatus.resubmission_required
}

async function findActiveApplicationForApplicant(applicantId: string, excludeId?: string) {
  return prisma.applicantApplication.findFirst({
    where: {
      applicantId,
      status: {
        notIn: [ApplicantApplicationStatus.disapproved, ApplicantApplicationStatus.released],
      },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

async function generateReferenceNumber(assistanceType: AssistanceType) {
  const prefix = assistanceType.toUpperCase().slice(0, 3)
  const today = new Date()
  const yyyymmdd = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('')
  const randomSuffix = crypto.randomInt(0, 1_000_000)
  return `APP-${prefix}-${yyyymmdd}-${String(randomSuffix).padStart(6, '0')}`
}

async function generateUniqueReferenceNumber(assistanceType: AssistanceType) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const referenceNumber = await generateReferenceNumber(assistanceType)
    const existing = await prisma.applicantApplication.findUnique({
      where: { referenceNumber },
      select: { id: true },
    })
    if (!existing) return referenceNumber
  }

  throw new HttpError(500, 'Unable to generate a unique application reference number')
}

async function resolveHospitalSelection(assistanceType: AssistanceType, hospitalFacilityId?: string | null) {
  const requiresHospital = assistanceType === AssistanceType.medical || assistanceType === AssistanceType.hospital
  if (!requiresHospital) return {}
  if (!hospitalFacilityId) {
    throw new HttpError(400, 'Hospital selection is required for medical and hospital assistance')
  }

  const facility = await prisma.hospitalFacility.findUnique({
    where: { id: hospitalFacilityId },
  })
  if (!facility) {
    throw new HttpError(400, 'Selected hospital facility was not found')
  }

  return {
    hospitalFacilityId: facility.id,
    hospitalFacilityName: facility.facilityName,
    hospitalFacilityType: facility.facilityType,
    hospitalFacilityAddress: facility.fullAddress,
    hospitalMunicipality: facility.municipality,
    hospitalProvince: facility.province,
  }
}

async function resolveMedicineSelection(
  assistanceType: AssistanceType,
  medicineItemId?: string | null,
  medicineItemIds: string[] = [],
) {
  if (assistanceType !== AssistanceType.medicine) return {}

  const normalizedIds = [...new Set(
    (medicineItemIds.length ? medicineItemIds : [medicineItemId ?? ''])
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  )]

  if (!normalizedIds.length) {
    throw new HttpError(400, 'Medicine selection is required for medicine assistance')
  }

  const medicines = await prisma.medicineItem.findMany({
    where: { id: { in: normalizedIds } },
  })

  if (medicines.length !== normalizedIds.length) {
    throw new HttpError(400, 'One or more selected medicines were not found')
  }

  const medicinesById = new Map(medicines.map((medicine) => [medicine.id, medicine]))
  const orderedMedicines = normalizedIds
    .map((id) => medicinesById.get(id))
    .filter((medicine): medicine is NonNullable<typeof medicine> => Boolean(medicine))

  const firstMedicine = orderedMedicines[0]

  return {
    medicineItemId: firstMedicine.id,
    medicineItemIds: orderedMedicines.map((medicine) => medicine.id),
    medicineGenericName: firstMedicine.genericName,
    medicineBrandName: firstMedicine.brandName,
    medicineUnit: firstMedicine.unit,
    medicineStrength: firstMedicine.strength,
    medicineCategory: firstMedicine.category,
    medicineSelections: orderedMedicines.map((medicine) => ({
      id: medicine.id,
      genericName: medicine.genericName,
      brandName: medicine.brandName,
      unit: medicine.unit,
      strength: medicine.strength,
      category: medicine.category,
    })),
  }
}

router.get('/hospital-facilities', requirePortalAuth, asyncHandler(async (_req, res) => {
  const facilities = await prisma.hospitalFacility.findMany({
    orderBy: [{ province: 'asc' }, { municipality: 'asc' }, { facilityName: 'asc' }],
    take: 500,
  })

  res.json({
    facilities: facilities.map((facility) => ({
      id: facility.id,
      province: facility.province,
      municipality: facility.municipality,
      facilityName: facility.facilityName,
      facilityType: facility.facilityType,
      fullAddress: facility.fullAddress,
    })),
  })
}))

router.get('/medicine-items', requirePortalAuth, asyncHandler(async (_req, res) => {
  const medicines = await prisma.medicineItem.findMany({
    orderBy: [{ genericName: 'asc' }, { brandName: 'asc' }],
    take: 500,
  })

  res.json({
    medicines: medicines.map((medicine) => ({
      id: medicine.id,
      genericName: medicine.genericName,
      brandName: medicine.brandName,
      unit: medicine.unit,
      strength: medicine.strength,
      category: medicine.category,
    })),
  })
}))

router.get('/funeral-homes', requirePortalAuth, asyncHandler(async (_req, res) => {
  const homes = await prisma.funeralHome.findMany({
    orderBy: { name: 'asc' },
    take: 500,
  })
  res.json({
    funeralHomes: homes.map((h) => ({
      id: h.id,
      name: h.name,
      ownerName: h.ownerName,
      address: h.address,
    })),
  })
}))

router.get('/mine', requirePortalAuth, asyncHandler(async (req, res) => {
  await ensureApplicant(req)
  const applications = await prisma.applicantApplication.findMany({
    where: { applicantId: req.applicant!.id },
    include: {
      documents: true,
      case: {
        include: {
          approvals: { orderBy: { actedAt: 'asc' } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ applications: applications.map(serializeApplication) })
}))

router.get('/notifications', requirePortalAuth, asyncHandler(async (req, res) => {
  await ensureApplicant(req)

  const applications = await prisma.applicantApplication.findMany({
    where: {
      applicantId: req.applicant!.id,
      OR: [
        { caseId: { not: null } },
        { status: ApplicantApplicationStatus.under_review },
        { status: ApplicantApplicationStatus.resubmission_required },
        { status: ApplicantApplicationStatus.approved },
      ],
    },
    include: {
      case: {
        include: {
          statusLogs: {
            where: {
              toStatus: { in: [...CASE_NOTIFICATION_STATUSES] },
            },
            orderBy: { changedAt: 'desc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const notifications = applications
    .flatMap((application) => {
      return [
        ...(application.status === ApplicantApplicationStatus.approved && !application.caseId ? [serializeApprovedNotification(application)] : []),
        ...(application.status === ApplicantApplicationStatus.resubmission_required ? [serializeResubmissionNotification(application)] : []),
        ...((application.case?.statusLogs ?? []).map((log) => serializeCaseStatusNotification(application, log))),
      ].filter((notification): notification is NonNullable<typeof notification> => Boolean(notification))
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  res.json({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
  })
}))

router.post('/notifications/read', requirePortalAuth, asyncHandler(async (req, res) => {
  await ensureApplicant(req)
  const body = notificationsReadSchema.parse(req.body)

  const grouped = body.notifications.reduce((map, notification) => {
    const list = map.get(notification.applicationId) || []
    list.push(notification.id)
    map.set(notification.applicationId, list)
    return map
  }, new Map<string, string[]>())

  for (const [applicationId, notificationIds] of grouped.entries()) {
    const application = await prisma.applicantApplication.findFirst({
      where: {
        id: applicationId,
        applicantId: req.applicant!.id,
      },
    })

    if (!application) continue

    const metadata = getApplicationMetadata(application)
    const currentReadIds = new Set(getReadNotificationIds(application))

    for (const notificationId of notificationIds) {
      if (body.read) {
        currentReadIds.add(notificationId)
      } else {
        currentReadIds.delete(notificationId)
      }
    }

    await prisma.applicantApplication.update({
      where: { id: application.id },
      data: {
        metadata: {
          ...metadata,
          portalReadNotifications: [...currentReadIds],
        },
      },
    })
  }

  res.json({ success: true })
}))

router.get('/:id', requirePortalAuth, asyncHandler(async (req, res) => {
  await ensureApplicant(req)
  const applicationId = String(req.params.id)
  const application = await assertOwnership(applicationId, req.applicant!.id)
  res.json({ application: serializeApplication(application) })
}))

router.get('/:id/guarantee-letter/pdf', requirePortalAuth, asyncHandler(async (req, res) => {
  await ensureApplicant(req)
  const applicationId = String(req.params.id)
  const application = await prisma.applicantApplication.findFirst({
    where: { id: applicationId, applicantId: req.applicant!.id },
    include: { case: true },
  })

  if (!application) throw new HttpError(404, 'Application not found')
  if (!application.caseId || !application.case) throw new HttpError(404, 'No linked case found for this application')
  if (!['approved', 'released'].includes(application.case.status)) {
    throw new HttpError(400, 'Guarantee letter is not yet available for this application')
  }
  if (!['burial', 'hospital', 'medical'].includes(application.assistanceType)) {
    throw new HttpError(400, 'Guarantee letter is not available for this assistance type')
  }

  const caseData = await loadGuaranteeLetterCase(application.caseId)
  const pdfBuffer = await generateGuaranteeLetterPdfForCase(caseData)
  const fileName = `${caseData.caseNumber ?? caseData.client.caseNumber}-guarantee-letter.pdf`

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.send(pdfBuffer)
}))

router.post('/', requirePortalAuth, asyncHandler(async (req, res) => {
  const applicant = await ensureApplicant(req)
  assertApplicantProfileComplete(applicant)
  const activeApplication = await findActiveApplicationForApplicant(applicant.id)
  if (activeApplication) {
    throw new HttpError(400, 'You already have an active application. Please continue your existing application instead of creating a new one.')
  }
  const body = applicationSchema.parse(req.body)
  const hospitalMetadata = await resolveHospitalSelection(body.assistanceType, body.hospitalFacilityId)
  const medicineMetadata = await resolveMedicineSelection(body.assistanceType, body.medicineItemId, body.medicineItemIds)

  const created = await prisma.applicantApplication.create({
    data: {
      applicantId: applicant.id,
      assistanceType: body.assistanceType,
      contactNumber: body.contactNumber || applicant.mobileNumber || null,
      reason: body.reason,
      householdMembers: body.householdMembers,
      metadata: { ...(body.metadata || {}), ...hospitalMetadata, ...medicineMetadata },
    },
    include: { documents: true },
  })

  res.status(201).json({ application: serializeApplication(created) })
}))

router.put('/:id', requirePortalAuth, asyncHandler(async (req, res) => {
  const applicant = await ensureApplicant(req)
  assertApplicantProfileComplete(applicant)
  const applicationId = String(req.params.id)
  const existing = await assertOwnership(applicationId, req.applicant!.id)
  if (!isApplicantEditableStatus(existing)) {
    throw new HttpError(400, 'Only draft or resubmission-required applications can be edited')
  }

  const body = applicationSchema.parse(req.body)
  const hospitalMetadata = await resolveHospitalSelection(body.assistanceType, body.hospitalFacilityId)
  const medicineMetadata = await resolveMedicineSelection(body.assistanceType, body.medicineItemId, body.medicineItemIds)
  const existingMetadata = getApplicationMetadata(existing)
  const updated = await prisma.applicantApplication.update({
    where: { id: existing.id },
    data: {
      assistanceType: body.assistanceType,
      contactNumber: body.contactNumber || null,
      reason: body.reason,
      householdMembers: body.householdMembers,
      metadata: {
        ...existingMetadata,
        ...(body.metadata || {}),
        ...hospitalMetadata,
        ...medicineMetadata,
      },
    },
    include: { documents: true },
  })

  res.json({ application: serializeApplication(updated) })
}))

router.delete('/:id', requirePortalAuth, asyncHandler(async (req, res) => {
  await ensureApplicant(req)
  const applicationId = String(req.params.id)
  const existing = await assertOwnership(applicationId, req.applicant!.id)
  if (existing.status !== ApplicantApplicationStatus.draft) {
    throw new HttpError(400, 'Only draft applications can be deleted')
  }

  for (const document of existing.documents ?? []) {
    if (!document.fileUrl) continue
    const relativePath = document.fileUrl.replace(/^\/+/, '').replace(/\//g, path.sep)
    const absolutePath = path.resolve(backendRoot, relativePath)
    if (absolutePath.startsWith(uploadDir) && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath)
    }
  }

  await prisma.applicantApplication.delete({
    where: { id: existing.id },
  })

  res.status(204).send()
}))

router.post('/:id/submit', requirePortalAuth, asyncHandler(async (req, res) => {
  const applicant = await ensureApplicant(req)
  assertApplicantProfileComplete(applicant)
  const applicationId = String(req.params.id)
  const existing = await assertOwnership(applicationId, req.applicant!.id)
  if (!isApplicantEditableStatus(existing)) {
    throw new HttpError(400, 'Application cannot be submitted in its current status')
  }
  if (!existing.reason?.trim()) {
    throw new HttpError(400, 'Application reason is required before submission')
  }

  let updated = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      updated = await prisma.applicantApplication.update({
        where: { id: existing.id },
        data: {
          status: ApplicantApplicationStatus.submitted,
          submittedAt: new Date(),
          referenceNumber: existing.referenceNumber || await generateUniqueReferenceNumber(existing.assistanceType),
        },
        include: { documents: true },
      })
      break
    } catch (error: any) {
      lastError = error
      if (!(error?.code === 'P2002' && Array.isArray(error?.meta?.target) && error.meta.target.includes('reference_number'))) {
        throw error
      }
    }
  }

  if (!updated) {
    throw lastError
  }

  res.json({ application: serializeApplication(updated) })
}))

router.post('/:id/documents', requirePortalAuth, upload.single('file'), asyncHandler(async (req, res) => {
  const file = req.file
  try {
    await ensureApplicant(req)
    const applicationId = String(req.params.id)
    const application = await assertOwnership(applicationId, req.applicant!.id)
    if (!isApplicantEditableStatus(application)) {
      throw new HttpError(400, 'Documents can only be uploaded to draft or resubmission-required applications')
    }
    if (!file) throw new HttpError(400, 'No document uploaded')

    const { detectedMimeType } = await validateStoredUpload(file, 'portalDocument')
    const documentType = String(req.body.documentType || '').trim()
    if (!documentType) throw new HttpError(400, 'Document type is required')

    const relativeUrl = `/uploads/portal-applications/${file.filename}`
    const document = await prisma.applicantApplicationDocument.create({
      data: {
        applicationId: application.id,
        documentType,
        originalName: file.originalname,
        fileUrl: relativeUrl,
        mimeType: detectedMimeType,
        sizeBytes: file.size,
      },
    })

    res.status(201).json({
      document: {
        id: document.id,
        documentType: document.documentType,
        originalName: document.originalName,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        uploadedAt: document.uploadedAt,
      },
    })
  } catch (error) {
    await removeStoredUpload(file)
    throw error
  }
}))

router.delete('/documents/:documentId', requirePortalAuth, asyncHandler(async (req, res) => {
  await ensureApplicant(req)
  const documentId = String(req.params.documentId)
  const document = await prisma.applicantApplicationDocument.findFirst({
    where: {
      id: documentId,
      application: { applicantId: req.applicant!.id },
    },
    include: { application: true },
  })

  if (!document) throw new HttpError(404, 'Document not found')
  if (!isApplicantEditableStatus(document.application)) {
    throw new HttpError(400, 'Documents can only be removed from draft or resubmission-required applications')
  }

  await prisma.applicantApplicationDocument.delete({ where: { id: document.id } })
  res.status(204).send()
}))

export default router
