import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { ApplicantApplicationStatus, AssistanceType, CaseStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/httpError.js'
import { generateCaseCaseNumber, generateClientCaseNumber } from '../utils/caseNumber.js'
import { sendPortalStatusNotifications } from '../services/portalStatusNotifications.js'
import { sendMail } from '../services/mailer.js'
import { sendSms } from '../services/sms.js'
import { auditLog } from '../utils/auditLog.js'
import { buildPersonMatchInput, duplicateConflict, findClientDuplicateMatches, mergeClientRecords, recordClientDedupEvent } from '../services/clientDedupService.js'
import { backendRoot } from '../utils/paths.js'

const router = Router()

const updateStatusSchema = z.object({
  status: z.enum(['submitted', 'under_review', 'resubmission_required', 'approved', 'disapproved', 'released']),
  adminNotes: z.string().optional().nullable(),
  createCase: z.boolean().optional().default(false),
  reuseClientId: z.string().uuid().optional().nullable(),
  overrideDuplicateReason: z.string().trim().min(3).max(500).optional().nullable(),
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Select at least one portal application to delete'),
})


function serialize(application: any) {
  const metadata = isRecord(application.metadata) ? application.metadata : {}

  return {
    id: application.id,
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
          assistanceType: application.case.assistanceType,
          approvals: (application.case.approvals ?? []).map((a: any) => ({
            stage: a.stage,
            action: a.action,
            actedByName: a.actedByName,
            actedByTitle: a.actedByTitle ?? null,
            actedAt: a.actedAt,
          })),
        }
      : null,
    applicant: application.applicant ? {
      id: application.applicant.id,
      email: application.applicant.email,
      firstName: application.applicant.firstName,
      lastName: application.applicant.lastName,
      mobileNumber: application.applicant.mobileNumber,
      barangay: application.applicant.barangay,
      municipality: application.applicant.municipality,
      province: application.applicant.province,
    } : null,
    documents: (application.documents ?? []).map((doc: any) => ({
      id: doc.id,
      documentType: doc.documentType,
      originalName: doc.originalName,
      fileUrl: doc.fileUrl,
      uploadedAt: doc.uploadedAt,
    })),
  }
}

function buildApplicantClientPayload(applicant: any) {
  return {
    applicantId: applicant.id,
    lastName: applicant.lastName,
    firstName: applicant.firstName,
    middleName: applicant.middleName,
    dateOfBirth: applicant.dateOfBirth,
    sex: applicant.sex,
    civilStatus: applicant.civilStatus,
    barangay: applicant.barangay,
    municipality: applicant.municipality,
    province: applicant.province,
    region: applicant.region,
    contactNumber: applicant.mobileNumber,
    occupation: applicant.occupation,
    religion: applicant.religion,
    is4ps: applicant.is4ps,
    isPwd: applicant.isPwd,
    isSenior: applicant.isSenior,
  }
}

function serializeClientMatch(client: any) {
  return client
    ? {
        id: client.id,
        caseNumber: client.caseNumber,
        firstName: client.firstName,
        lastName: client.lastName,
        dateOfBirth: client.dateOfBirth?.toISOString?.().slice(0, 10) ?? null,
      }
    : null
}

async function ensureClientForApplicant(
  applicant: any,
  options: {
    actorId?: string | null
    reuseClientId?: string | null
    overrideDuplicateReason?: string | null
  } = {}
) {
  const payload = {
    ...buildApplicantClientPayload(applicant),
  }

  const currentClient = applicant.client && !applicant.client.mergedIntoClientId ? applicant.client : null
  const duplicateResult = await findClientDuplicateMatches(prisma, buildPersonMatchInput({
    applicantId: applicant.id,
    email: applicant.email,
    contactNumber: applicant.mobileNumber,
    firstName: applicant.firstName,
    lastName: applicant.lastName,
    middleName: applicant.middleName,
    dateOfBirth: applicant.dateOfBirth,
    sex: applicant.sex,
    barangay: applicant.barangay,
    municipality: applicant.municipality,
    province: applicant.province,
  }), { excludeClientId: currentClient?.id ?? null })

  if (duplicateResult.duplicateStatus !== 'no_match' && !options.reuseClientId && !options.overrideDuplicateReason) {
    throw duplicateConflict('A possible duplicate client was found for this portal applicant. Review the existing profile before creating the staff case.', duplicateResult, {
      currentLinkedClient: serializeClientMatch(currentClient),
    })
  }

  if (options.reuseClientId) {
    return prisma.$transaction(async (tx) => {
      const target = await tx.client.findFirst({
        where: { id: options.reuseClientId ?? '', mergedIntoClientId: null },
      })
      if (!target) throw new HttpError(404, 'Selected existing client was not found.')
      if (target.applicantId && target.applicantId !== applicant.id) {
        throw new HttpError(400, 'Selected client is already linked to a different portal applicant.')
      }

      if (currentClient && currentClient.id !== target.id) {
        await mergeClientRecords(tx, {
          sourceClientId: currentClient.id,
          targetClientId: target.id,
          actorId: options.actorId ?? null,
          notes: 'Portal application reused an existing client profile during staff case creation.',
          payload: { applicantId: applicant.id, source: 'portal_case_creation' },
        })
      }

      const updated = await tx.client.update({
        where: { id: target.id },
        data: payload,
      })

      await recordClientDedupEvent(tx, {
        actorId: options.actorId ?? null,
        applicantId: applicant.id,
        sourceClientId: currentClient?.id ?? null,
        targetClientId: updated.id,
        action: 'portal_case_reuse_existing_client',
        notes: currentClient && currentClient.id !== updated.id
          ? 'Existing portal-linked client merged into selected staff client during case creation.'
          : 'Selected existing client reused during case creation.',
        payload: {
          duplicateStatus: duplicateResult.duplicateStatus,
          matches: duplicateResult.matches.map((match) => ({ id: match.id, score: match.score })),
        },
      })

      return updated
    })
  }

  if (currentClient) {
    const updated = await prisma.client.update({
      where: { id: currentClient.id },
      data: payload,
    })

    if (options.overrideDuplicateReason) {
      await recordClientDedupEvent(prisma, {
        actorId: options.actorId ?? null,
        applicantId: applicant.id,
        sourceClientId: updated.id,
        action: 'portal_case_override_existing_client',
        notes: options.overrideDuplicateReason,
        payload: {
          duplicateStatus: duplicateResult.duplicateStatus,
          matches: duplicateResult.matches.map((match) => ({ id: match.id, score: match.score })),
        },
      })
    }

    return updated
  }

  const caseNumber = await generateClientCaseNumber()
  const created = await prisma.client.create({
    data: {
      caseNumber,
      clientCategory: 'walk_in',
      ...payload,
    },
  })

  if (options.overrideDuplicateReason) {
    await recordClientDedupEvent(prisma, {
      actorId: options.actorId ?? null,
      applicantId: applicant.id,
      sourceClientId: created.id,
      action: 'portal_case_create_override',
      notes: options.overrideDuplicateReason,
      payload: {
        duplicateStatus: duplicateResult.duplicateStatus,
        matches: duplicateResult.matches.map((match) => ({ id: match.id, score: match.score })),
      },
    })
  }

  return created
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildPortalAuditFlags(application: any) {
  const metadata = isRecord(application.metadata) ? application.metadata : {}
  const medicineSelections: unknown[] = Array.isArray(metadata.medicineSelections) ? metadata.medicineSelections : []
  const selectedMedicineNames = medicineSelections
    .map((medicine: unknown) => {
      if (!isRecord(medicine)) return null
      const genericName = typeof medicine.genericName === 'string' ? medicine.genericName.trim() : ''
      const brandName = typeof medicine.brandName === 'string' ? medicine.brandName.trim() : ''
      if (!genericName) return null
      return brandName ? `${genericName} - ${brandName}` : genericName
    })
    .filter((name: string | null): name is string => Boolean(name))

  return {
    portal_application_id: application.id,
    portal_reference_number: application.referenceNumber ?? null,
    portal_application_metadata: metadata,
    portal_selected_hospital_name: typeof metadata.hospitalFacilityName === 'string' ? metadata.hospitalFacilityName : null,
    portal_selected_medicine_name:
      selectedMedicineNames[0] ??
      (typeof metadata.medicineGenericName === 'string' ? metadata.medicineGenericName : null),
  }
}


function applicantApplicationIncludes() {
  return {
    applicant: {
      include: {
        client: true,
      },
    },
    documents: true,
    case: {
      include: {
        approvals: { orderBy: { actedAt: 'asc' } },
      },
    },
  } as const
}

async function deletePortalApplicationFiles(application: any) {
  for (const document of application.documents ?? []) {
    if (!document.fileUrl) continue
    const relativePath = String(document.fileUrl).replace(/^\/+/, '').replace(/\//g, path.sep)
    const absolutePath = path.resolve(backendRoot, relativePath)
    if (!fs.existsSync(absolutePath)) continue

    try {
      fs.unlinkSync(absolutePath)
    } catch (error) {
      console.error('[Portal Application Delete] Failed to remove file', absolutePath, error)
    }
  }
}

async function deletePortalApplicationById(id: string, actorId?: string) {
  const application = await prisma.applicantApplication.findUnique({
    where: { id },
    include: {
      documents: true,
      case: {
        select: {
          id: true,
          caseNumber: true,
          status: true,
        },
      },
    },
  })

  if (!application) {
    throw new HttpError(404, 'Application not found')
  }

  await deletePortalApplicationFiles(application)
  await prisma.$transaction(async (tx) => {
    if (application.case) {
      if (actorId) {
        await auditLog(tx, {
          caseId: application.case.id,
          changedById: actorId,
          fromStatus: application.case.status as CaseStatus,
          toStatus: application.case.status as CaseStatus,
          notes: `Portal application${application.referenceNumber ? ` ${application.referenceNumber}` : ''} deleted together with linked staff case`,
        })
      }

      await tx.case.delete({ where: { id: application.case.id } })
    }

    await tx.applicantApplication.delete({ where: { id: application.id } })
  })

  return application
}

async function createCaseFromAcceptedApplication(
  application: any,
  actor: NonNullable<Express.Request['user']>,
  options: { reuseClientId?: string | null; overrideDuplicateReason?: string | null } = {}
) {
  if (application.caseId) {
    const existingCase = await prisma.case.findUnique({ where: { id: application.caseId } })
    if (existingCase) return existingCase
  }

  const client = await ensureClientForApplicant(application.applicant, {
    actorId: actor.id,
    reuseClientId: options.reuseClientId ?? null,
    overrideDuplicateReason: options.overrideDuplicateReason ?? null,
  })
  const metadata = isRecord(application.metadata) ? application.metadata : {}
  const hospitalName = typeof metadata.hospitalFacilityName === 'string' ? metadata.hospitalFacilityName.trim() : ''
  const hospitalAddress = (() => {
    const addr = typeof metadata.hospitalFacilityAddress === 'string' ? metadata.hospitalFacilityAddress.trim() : ''
    if (addr) return addr
    const muni = typeof metadata.hospitalMunicipality === 'string' ? metadata.hospitalMunicipality.trim() : ''
    const prov = typeof metadata.hospitalProvince === 'string' ? metadata.hospitalProvince.trim() : ''
    return [muni, prov].filter(Boolean).join(', ')
  })()
  const medicineItemId = typeof metadata.medicineItemId === 'string' ? metadata.medicineItemId.trim() : ''
  const medicineGenericName = typeof metadata.medicineGenericName === 'string' ? metadata.medicineGenericName.trim() : ''
  const medicineSelections = Array.isArray(metadata.medicineSelections)
    ? metadata.medicineSelections.filter((medicine: unknown): medicine is Record<string, unknown> => isRecord(medicine))
    : []
  const deceasedName = typeof metadata.deceasedName === 'string' ? metadata.deceasedName.trim() : ''
  const deceasedAddress = typeof metadata.deceasedAddress === 'string' ? metadata.deceasedAddress.trim() : ''
  const rawDeceasedAge = metadata.deceasedAge
  const deceasedAge = rawDeceasedAge == null ? null : (typeof rawDeceasedAge === 'number' ? rawDeceasedAge : Number(rawDeceasedAge))
  const deceasedOccupation = typeof metadata.deceasedOccupation === 'string' ? metadata.deceasedOccupation.trim() : ''
  const deceasedCivilStatus = typeof metadata.deceasedCivilStatus === 'string' ? metadata.deceasedCivilStatus.trim() : ''
  const deceasedSex = typeof metadata.deceasedSex === 'string' ? metadata.deceasedSex.trim() : ''
  const funeralHomeName = typeof metadata.funeralHomeName === 'string' ? metadata.funeralHomeName.trim() : ''
  const funeralHomeOwnerName = typeof metadata.funeralHomeOwnerName === 'string' ? metadata.funeralHomeOwnerName.trim() : ''
  const funeralHomeAddress = typeof metadata.funeralHomeAddress === 'string' ? metadata.funeralHomeAddress.trim() : ''
  const typeOfBill = typeof metadata.typeOfBill === 'string' ? metadata.typeOfBill.trim() : ''
  const intermentPlace = typeof metadata.intermentPlace === 'string' ? metadata.intermentPlace.trim() : ''
  const conformeName = typeof metadata.conformeName === 'string' ? metadata.conformeName.trim() : ''
  const conformeRelationship = typeof metadata.conformeRelationship === 'string' ? metadata.conformeRelationship.trim() : ''
  const doctorName = typeof metadata.doctorName === 'string' ? metadata.doctorName.trim() : ''
  const doctorPosition = typeof metadata.doctorPosition === 'string' ? metadata.doctorPosition.trim() : ''
  const clinicName = typeof metadata.clinicName === 'string' ? metadata.clinicName.trim() : ''
  const clinicAddress = typeof metadata.clinicAddress === 'string' ? metadata.clinicAddress.trim() : ''
  const requestedMedicalAssistance =
    typeof metadata.medicalRequestedAssistance === 'string'
      ? metadata.medicalRequestedAssistance.trim()
      : (typeof metadata.medicalType === 'string' ? metadata.medicalType.trim() : '')
  const resolvedAssessmentDate =
    application.submittedAt
    ?? application.reviewedAt
    ?? application.createdAt
  const newCaseNumber = await generateCaseCaseNumber(application.assistanceType)

  const created = await prisma.$transaction(async (tx) => {
    const createdCase = await tx.case.create({
      data: {
        clientId: client.id,
        caseNumber: newCaseNumber,
        assistanceType: application.assistanceType,
        status: 'intake',
        socialWorkerId: actor.id,
        socialWorkerName: actor.name,
        socialWorkerEmpId: actor.employeeId,
        dateOfAssessment: resolvedAssessmentDate,
        presentingProblem: application.reason ?? null,
        familyComposition: application.householdMembers ?? [],
        backgroundOfProblem: application.reason ?? null,
        assessment: null,
        hospitalClinic: hospitalName || null,
        auditFlags: buildPortalAuditFlags(application),
      },
    })

    await tx.applicantApplication.update({
      where: { id: application.id },
      data: { caseId: createdCase.id },
    })

    await auditLog(tx, {
      caseId: createdCase.id,
      changedById: actor.id,
      fromStatus: 'intake',
      toStatus: 'intake',
      notes: `Case created from approved portal application${application.referenceNumber ? ` ${application.referenceNumber}` : ''}`,
    })

    if (application.assistanceType === 'hospital') {
      await tx.hospitalDetail.upsert({
        where: { caseId: createdCase.id },
        update: {
          hospitalName: hospitalName || null,
          hospitalAddress: hospitalAddress || null,
          doctorName: doctorName || null,
          mdPosition: doctorPosition || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
        create: {
          caseId: createdCase.id,
          templateType: 'personal',
          hospitalName: hospitalName || null,
          hospitalAddress: hospitalAddress || null,
          doctorName: doctorName || null,
          mdPosition: doctorPosition || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
      })
    }

    if (application.assistanceType === 'medical') {
      await tx.medicalDetail.upsert({
        where: { caseId: createdCase.id },
        update: {
          clinicName: hospitalName || null,
          clinicAddress: hospitalAddress || null,
          doctorName: doctorName || null,
          mdPosition: doctorPosition || null,
          medicalType: requestedMedicalAssistance || null,
          operationType: requestedMedicalAssistance || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
        create: {
          caseId: createdCase.id,
          templateType: 'personal',
          clinicName: hospitalName || null,
          clinicAddress: hospitalAddress || null,
          doctorName: doctorName || null,
          mdPosition: doctorPosition || null,
          medicalType: requestedMedicalAssistance || null,
          operationType: requestedMedicalAssistance || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
      })
    }

    if (application.assistanceType === 'eyeglass') {
      await tx.eyeglassDetail.upsert({
        where: { caseId: createdCase.id },
        update: {
          doctorName: doctorName || null,
          clinicName: clinicName || null,
          clinicAddress: clinicAddress || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
        create: {
          caseId: createdCase.id,
          doctorName: doctorName || null,
          clinicName: clinicName || null,
          clinicAddress: clinicAddress || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
      })
    }

    if (application.assistanceType === 'medicine') {
      type PortalMedicineSelection = { id: string; genericName: string }
      type CaseMedicineDraft = {
        medicineId: string | null
        medicineName: string
        quantity: Prisma.Decimal
        unit: string | null
        unitPrice: Prisma.Decimal
        totalPrice: Prisma.Decimal
      }

      const normalizedSelections = medicineSelections.length
        ? medicineSelections.map((medicine: Record<string, unknown>): PortalMedicineSelection => ({
            id: typeof medicine.id === 'string' ? medicine.id.trim() : '',
            genericName: typeof medicine.genericName === 'string' ? medicine.genericName.trim() : '',
          })).filter((medicine: PortalMedicineSelection) => medicine.id || medicine.genericName)
        : [{ id: medicineItemId, genericName: medicineGenericName }].filter((medicine: PortalMedicineSelection) => medicine.id || medicine.genericName)

      const selectedMedicineIds = [...new Set(normalizedSelections.map((medicine: PortalMedicineSelection) => medicine.id).filter(Boolean))] as string[]
      const selectedMedicines = selectedMedicineIds.length
        ? await tx.medicineItem.findMany({
            where: { id: { in: selectedMedicineIds } },
            select: {
              id: true,
              genericName: true,
              unit: true,
              unitPrice: true,
            },
          })
        : []
      const selectedMedicinesById = new Map(selectedMedicines.map((medicine) => [medicine.id, medicine]))

      const caseMedicines = normalizedSelections.map((medicine: PortalMedicineSelection): CaseMedicineDraft => {
        const selectedMedicine = medicine.id ? selectedMedicinesById.get(medicine.id) ?? null : null
        const unitPrice = selectedMedicine ? Number(selectedMedicine.unitPrice) : 0

        return {
          medicineId: selectedMedicine?.id ?? null,
          medicineName: selectedMedicine?.genericName ?? medicine.genericName,
          quantity: new Prisma.Decimal(1),
          unit: selectedMedicine?.unit ?? null,
          unitPrice: new Prisma.Decimal(unitPrice),
          totalPrice: new Prisma.Decimal(unitPrice),
        }
      }).filter((medicine: CaseMedicineDraft) => medicine.medicineName)

      if (caseMedicines.length) {
        await tx.caseMedicine.createMany({
          data: caseMedicines.map((medicine: CaseMedicineDraft) => ({
            caseId: createdCase.id,
            medicineId: medicine.medicineId,
            medicineName: medicine.medicineName,
            quantity: medicine.quantity,
            unit: medicine.unit,
            unitPrice: medicine.unitPrice,
            totalPrice: medicine.totalPrice,
          })),
        })

        const totalAmount = caseMedicines.reduce((sum: number, medicine: CaseMedicineDraft) => sum + Number(medicine.totalPrice), 0)
        await tx.case.update({
          where: { id: createdCase.id },
          data: {
            amount: new Prisma.Decimal(totalAmount),
          },
        })
      }
    }

    if (application.assistanceType === 'burial') {
      await tx.burialDetail.upsert({
        where: { caseId: createdCase.id },
        update: {
          deceasedName: deceasedName || null,
          deceasedAddress: deceasedAddress || null,
          deceasedAge: deceasedAge != null && Number.isFinite(deceasedAge) ? Math.max(0, Math.round(deceasedAge)) : null,
          deceasedOccupation: deceasedOccupation || null,
          deceasedCivilStatus: deceasedCivilStatus || null,
          deceasedSex: deceasedSex || null,
          funeralHome: funeralHomeName || null,
          funeralHomeOwner: funeralHomeOwnerName || null,
          funeralOwnerAddress: funeralHomeAddress || null,
          typeOfBill: typeOfBill || null,
          intermentPlace: intermentPlace || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
        create: {
          caseId: createdCase.id,
          deceasedName: deceasedName || null,
          deceasedAddress: deceasedAddress || null,
          deceasedAge: deceasedAge != null && Number.isFinite(deceasedAge) ? Math.max(0, Math.round(deceasedAge)) : null,
          deceasedOccupation: deceasedOccupation || null,
          deceasedCivilStatus: deceasedCivilStatus || null,
          deceasedSex: deceasedSex || null,
          funeralHome: funeralHomeName || null,
          funeralHomeOwner: funeralHomeOwnerName || null,
          funeralOwnerAddress: funeralHomeAddress || null,
          typeOfBill: typeOfBill || null,
          intermentPlace: intermentPlace || null,
          conformeName: conformeName || null,
          conformeRelationship: conformeRelationship || null,
        },
      })
    }

    return createdCase
  })

  return created
}

router.get('/', asyncHandler(async (req, res) => {
  const statusFilter = String(req.query.status || '').trim()
  const search = String(req.query.search || '').trim()
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '5'), 10) || 5))
  const skip = (page - 1) * limit

  const where: any = {}

  if (search) {
    where.OR = [
      { referenceNumber: { contains: search, mode: 'insensitive' } },
      { applicant: { firstName: { contains: search, mode: 'insensitive' } } },
      { applicant: { lastName: { contains: search, mode: 'insensitive' } } },
      { applicant: { email: { contains: search, mode: 'insensitive' } } },
    ]
  }

  if (statusFilter) {
    where.status = statusFilter
  }

  const [applications, total] = await prisma.$transaction([
    prisma.applicantApplication.findMany({
      where,
      include: applicantApplicationIncludes(),
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.applicantApplication.count({ where }),
  ])

  res.json({
    applications: applications.map(serialize),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}))

router.post('/:id/duplicate-check', asyncHandler(async (req, res) => {
  const applicationId = String(req.params.id)
  const application = await prisma.applicantApplication.findUnique({
    where: { id: applicationId },
    include: applicantApplicationIncludes(),
  })

  if (!application) throw new HttpError(404, 'Application not found')

  const duplicateResult = await findClientDuplicateMatches(prisma, buildPersonMatchInput({
    applicantId: application.applicant.id,
    email: application.applicant.email,
    contactNumber: application.applicant.mobileNumber,
    firstName: application.applicant.firstName,
    lastName: application.applicant.lastName,
    middleName: application.applicant.middleName,
    dateOfBirth: application.applicant.dateOfBirth,
    sex: application.applicant.sex,
    barangay: application.applicant.barangay,
    municipality: application.applicant.municipality,
    province: application.applicant.province,
  }), { excludeClientId: application.applicant.client?.mergedIntoClientId ? null : application.applicant.client?.id ?? null })

  res.json({
    ...duplicateResult,
    currentLinkedClient: serializeClientMatch(application.applicant.client && !application.applicant.client.mergedIntoClientId ? application.applicant.client : null),
  })
}))

router.get('/documents/:documentId/file', asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const documentId = String(req.params.documentId)
  const document = await prisma.applicantApplicationDocument.findUnique({
    where: { id: documentId },
    select: {
      originalName: true,
      fileUrl: true,
      mimeType: true,
    },
  })

  if (!document?.fileUrl) throw new HttpError(404, 'Document not found')

  const relativePath = String(document.fileUrl).replace(/^\/+/, '').replace(/\//g, path.sep)
  const absolutePath = path.resolve(backendRoot, relativePath)
  if (!fs.existsSync(absolutePath)) {
    throw new HttpError(404, 'Document file not found')
  }

  res.setHeader('Content-Type', document.mimeType || 'application/octet-stream')
  res.setHeader('Content-Disposition', `inline; filename="${document.originalName || 'document'}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.sendFile(absolutePath)
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const applicationId = String(req.params.id)
  const application = await prisma.applicantApplication.findUnique({
    where: { id: applicationId },
    include: applicantApplicationIncludes(),
  })

  if (!application) throw new HttpError(404, 'Application not found')
  res.json({ application: serialize(application) })
}))

router.patch('/:id/status', asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const applicationId = String(req.params.id)
  const existing = await prisma.applicantApplication.findUnique({
    where: { id: applicationId },
    include: applicantApplicationIncludes(),
  })

  if (!existing) throw new HttpError(404, 'Application not found')

  const body = updateStatusSchema.parse(req.body)
  let linkedCase: Prisma.CaseGetPayload<{}> | null = null

  if (body.createCase && body.status !== 'under_review') {
    throw new HttpError(400, 'Case creation must move the application into under review.')
  }
  if (body.createCase && existing.status !== ApplicantApplicationStatus.approved) {
    throw new HttpError(400, 'Only approved portal applications can be converted into staff cases.')
  }
  if (body.status === 'under_review' && !existing.caseId && !body.createCase) {
    throw new HttpError(400, 'Application must have a linked staff case before it can be moved into under review.')
  }
  if (existing.caseId && body.status !== existing.status) {
    throw new HttpError(400, 'Applications with linked staff cases must continue through the case workflow.')
  }

  if (body.createCase) {
    linkedCase = await createCaseFromAcceptedApplication(existing, req.user, {
      reuseClientId: body.reuseClientId ?? null,
      overrideDuplicateReason: body.overrideDuplicateReason ?? null,
    })
  }

  const updated = await prisma.applicantApplication.update({
    where: { id: existing.id },
    data: {
      status: body.status,
      adminNotes: body.adminNotes ?? null,
      reviewedAt: ['under_review', 'resubmission_required', 'approved', 'disapproved', 'released'].includes(body.status) ? new Date() : existing.reviewedAt,
      ...(linkedCase ? { caseId: linkedCase.id } : {}),
    },
    include: applicantApplicationIncludes(),
  })

  if (existing.status !== updated.status) {
    sendPortalStatusNotifications(updated).catch(console.error)
  }

  res.json({ application: serialize(updated) })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const applicationId = String(req.params.id)
  const deleted = await deletePortalApplicationById(applicationId, req.user.id)

  res.json({
    deleted: {
      id: deleted.id,
      referenceNumber: deleted.referenceNumber,
      linkedCaseId: deleted.case?.id ?? null,
      linkedCaseNumber: deleted.case?.caseNumber ?? null,
    },
  })
}))

router.post('/bulk-delete', asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized')

  const { ids } = bulkDeleteSchema.parse(req.body)
  const uniqueIds = [...new Set(ids)]
  const deleted = []

  for (const id of uniqueIds) {
    const application = await deletePortalApplicationById(id, req.user.id)
    deleted.push({
      id: application.id,
      referenceNumber: application.referenceNumber,
      linkedCaseId: application.case?.id ?? null,
      linkedCaseNumber: application.case?.caseNumber ?? null,
    })
  }

  res.json({
    deletedCount: deleted.length,
    deleted,
  })
}))

export default router
