import type { Request, Response } from 'express'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { env } from '../config/env.js'
import { currencyFromDb, parseCurrencyAmount, toOptionalInt } from '../utils/currency.js'
import { assertCaseReadable, assertEditableCase, paramId } from '../services/caseService.js'
import { signedGlPublicUrl } from '../services/storageService.js'
import { updateBurialSchema, updateHospitalSchema, updateMedicalSchema, updateEyeglassSchema, updatePlainSchema } from '../schemas/caseSchemas.js'
import { removeStoredUpload, validateStoredUpload } from '../services/uploadValidation.js'
import { resetApprovalsAfterMaterialEdit, valuesDiffer } from '../services/workflowIntegrityService.js'
import { getApprovalSettings } from '../queries/caseQueries.js'
import { resolveApprovalAssignees } from '../services/approvalService.js'
import { userCanUploadReportSignatureStage } from '../services/reportSignatureService.js'

const HOSPITAL_MEDICAL_GL_MAX_AMOUNT = 30000
const PLAIN_ASSISTANCE_KIND_VALUES = ['medical', 'hospital', 'burial'] as const

function addChangedField(changedFields: string[], label: string, currentValue: unknown, nextValue: unknown) {
  if (valuesDiffer(currentValue ?? null, nextValue ?? null)) {
    changedFields.push(label)
  }
}

function normalizePlainAssistanceKinds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>(PLAIN_ASSISTANCE_KIND_VALUES)
  return [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowed.has(item))
  )]
}

function shouldResetSignedGl(changedFields: string[]) {
  return changedFields.length > 0
}

async function assertSignedGlUploadAllowed(
  caseData: { status: string; socialWorkerId: string | null; auditFlags?: unknown },
  user: Express.AuthUser | undefined,
) {
  if (caseData.status === 'rejected') {
    throw new HttpError(400, `Signed guarantee letter cannot be uploaded when case is ${caseData.status}.`)
  }

  // Once released, the approver's own upload window (below) has already closed — the case
  // maker who owns the case takes over instead, uploading the final scanned/signed copy
  // for record-keeping (e.g. the physical letter came back from the mayor's office after
  // the case had already moved to released).
  if (caseData.status === 'released') {
    const isOwner = Boolean(user && caseData.socialWorkerId && caseData.socialWorkerId === user.id)
    if (!isOwner && user?.role !== 'admin') {
      throw new HttpError(403, 'Only the assigned case maker or an admin can upload the signed guarantee letter once released.')
    }
    return
  }

  const isOwner = Boolean(user && caseData.socialWorkerId && caseData.socialWorkerId === user.id)
  if (isOwner) return

  const settings = await getApprovalSettings()
  const assigneesByStage = await resolveApprovalAssignees(settings)
  const approverStage = {
    key: 'for_approval' as const,
    assignedUserId: assigneesByStage.for_approval?.id ?? null,
  }

  if (!userCanUploadReportSignatureStage(user, approverStage, caseData)) {
    throw new HttpError(403, 'Only the assigned case maker or approver can upload the mayor-signed guarantee letter.')
  }

}

// ── Burial ──────────────────────────────────────────────────────────────────

export async function getBurial(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { burialDetails: true, client: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Burial details')

  res.json({
    caseId: caseData.id,
    caseNumber: caseData.caseNumber ?? caseData.client.caseNumber,
    amount: currencyFromDb(caseData.amount),
    beneficiaryName:
      String(caseData.burialDetails?.deceasedName ?? '').trim() ||
      [caseData.client.firstName, caseData.client.middleName, caseData.client.lastName].filter(Boolean).join(' '),
    beneficiaryAddress:
      String(caseData.burialDetails?.deceasedAddress ?? '').trim() ||
      [caseData.client.barangay, caseData.client.municipality, caseData.client.province].filter(Boolean).join(', '),
    proxyName: [caseData.client.firstName, caseData.client.middleName, caseData.client.lastName].filter(Boolean).join(' '),
    proxyRelationship: caseData.burialDetails?.conformeRelationship ?? null,
    burialDetails: caseData.burialDetails
      ? {
          id: caseData.burialDetails.id,
          deceasedName: caseData.burialDetails.deceasedName,
          deceasedAddress: caseData.burialDetails.deceasedAddress ?? null,
          deceasedAge: caseData.burialDetails.deceasedAge ?? null,
          deceasedOccupation: caseData.burialDetails.deceasedOccupation ?? null,
          deceasedCivilStatus: caseData.burialDetails.deceasedCivilStatus ?? null,
          deceasedSex: caseData.burialDetails.deceasedSex ?? null,
          dateOfDeath: caseData.burialDetails.dateOfDeath?.toISOString().slice(0, 10) ?? null,
          causeOfDeath: caseData.burialDetails.causeOfDeath,
          funeralHome: caseData.burialDetails.funeralHome,
          funeralHomeOwner: caseData.burialDetails.funeralHomeOwner ?? null,
          funeralOwnerAddress: caseData.burialDetails.funeralOwnerAddress ?? null,
          typeOfBill: caseData.burialDetails.typeOfBill ?? null,
          intermentPlace: caseData.burialDetails.intermentPlace ?? null,
          conformeName: caseData.burialDetails.conformeName ?? null,
          conformeRelationship: caseData.burialDetails.conformeRelationship ?? null,
          guaranteeLetterUrl: caseData.burialDetails.guaranteeLetterUrl,
          signedGlUrl: caseData.burialDetails.signedGlUrl,
          glUploadedAt: caseData.burialDetails.glUploadedAt,
        }
      : null,
  })
}

export async function updateBurial(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = updateBurialSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true, burialDetails: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Burial details')
  if (caseData.assistanceType !== 'burial') throw new HttpError(400, 'Only burial cases can store burial details')

  const amount =
    body.amount == null || (typeof body.amount === 'string' && body.amount.trim() === '')
      ? currencyFromDb(caseData.amount)
      : parseCurrencyAmount(body.amount)
  if (amount > env.burialGlMaxAmount) {
    throw new HttpError(400, `Burial amount cannot exceed PHP ${env.burialGlMaxAmount.toFixed(2)}`)
  }

  const deceasedAge = toOptionalInt(body.deceasedAge)
  const guaranteeLetterUrl = `${env.apiBaseUrl}/api/cases/${caseData.id}/guarantee-letter/pdf`
  const nextDateOfDeath = body.dateOfDeath ? new Date(body.dateOfDeath) : body.dateOfDeath === null ? null : caseData.burialDetails?.dateOfDeath ?? null
  const changedFields: string[] = []
  addChangedField(changedFields, 'deceasedName', caseData.burialDetails?.deceasedName ?? null, body.deceasedName ?? null)
  addChangedField(changedFields, 'deceasedAddress', caseData.burialDetails?.deceasedAddress ?? null, body.deceasedAddress ?? null)
  addChangedField(changedFields, 'deceasedAge', caseData.burialDetails?.deceasedAge ?? null, deceasedAge ?? null)
  addChangedField(changedFields, 'deceasedOccupation', caseData.burialDetails?.deceasedOccupation ?? null, body.deceasedOccupation ?? null)
  addChangedField(changedFields, 'deceasedCivilStatus', caseData.burialDetails?.deceasedCivilStatus ?? null, body.deceasedCivilStatus ?? null)
  addChangedField(changedFields, 'deceasedSex', caseData.burialDetails?.deceasedSex ?? null, body.deceasedSex ?? null)
  addChangedField(changedFields, 'dateOfDeath', caseData.burialDetails?.dateOfDeath?.toISOString().slice(0, 10) ?? null, nextDateOfDeath?.toISOString().slice(0, 10) ?? null)
  addChangedField(changedFields, 'causeOfDeath', caseData.burialDetails?.causeOfDeath ?? null, body.causeOfDeath ?? null)
  addChangedField(changedFields, 'funeralHome', caseData.burialDetails?.funeralHome ?? null, body.funeralHome ?? null)
  addChangedField(changedFields, 'funeralHomeOwner', caseData.burialDetails?.funeralHomeOwner ?? null, body.funeralHomeOwner ?? null)
  addChangedField(changedFields, 'funeralOwnerAddress', caseData.burialDetails?.funeralOwnerAddress ?? null, body.funeralOwnerAddress ?? null)
  addChangedField(changedFields, 'typeOfBill', caseData.burialDetails?.typeOfBill ?? null, body.typeOfBill ?? null)
  addChangedField(changedFields, 'intermentPlace', caseData.burialDetails?.intermentPlace ?? null, body.intermentPlace ?? null)
  addChangedField(changedFields, 'conformeName', caseData.burialDetails?.conformeName ?? null, body.conformeName ?? null)
  addChangedField(changedFields, 'conformeRelationship', caseData.burialDetails?.conformeRelationship ?? null, body.conformeRelationship ?? null)
  addChangedField(changedFields, 'amount', currencyFromDb(caseData.amount), amount)

  const result = await prisma.$transaction(async (tx) => {
    const burial = await tx.burialDetail.upsert({
      where: { caseId: caseData.id },
      update: {
        deceasedName: body.deceasedName,
        deceasedAddress: body.deceasedAddress,
        deceasedAge: deceasedAge === null ? null : deceasedAge,
        deceasedOccupation: body.deceasedOccupation,
        deceasedCivilStatus: body.deceasedCivilStatus,
        deceasedSex: body.deceasedSex,
        dateOfDeath: body.dateOfDeath ? new Date(body.dateOfDeath) : body.dateOfDeath === null ? null : undefined,
        causeOfDeath: body.causeOfDeath,
        funeralHome: body.funeralHome,
        funeralHomeOwner: body.funeralHomeOwner,
        funeralOwnerAddress: body.funeralOwnerAddress,
        typeOfBill: body.typeOfBill,
        intermentPlace: body.intermentPlace,
        conformeName: body.conformeName,
        conformeRelationship: body.conformeRelationship,
        guaranteeLetterUrl,
        ...(shouldResetSignedGl(changedFields) ? { signedGlUrl: null, glUploadedAt: null } : {}),
      },
      create: {
        caseId: caseData.id,
        deceasedName: body.deceasedName ?? null,
        deceasedAddress: body.deceasedAddress ?? null,
        deceasedAge: deceasedAge ?? null,
        deceasedOccupation: body.deceasedOccupation ?? null,
        deceasedCivilStatus: body.deceasedCivilStatus ?? null,
        deceasedSex: body.deceasedSex ?? null,
        dateOfDeath: body.dateOfDeath ? new Date(body.dateOfDeath) : null,
        causeOfDeath: body.causeOfDeath ?? null,
        funeralHome: body.funeralHome ?? null,
        funeralHomeOwner: body.funeralHomeOwner ?? null,
        funeralOwnerAddress: body.funeralOwnerAddress ?? null,
        typeOfBill: body.typeOfBill ?? null,
        intermentPlace: body.intermentPlace ?? null,
        conformeName: body.conformeName ?? null,
        conformeRelationship: body.conformeRelationship ?? null,
        guaranteeLetterUrl,
      },
    })
    await tx.case.update({ where: { id: caseData.id }, data: { amount } })
    const resetResult = await resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields,
    })
    return { burial, resetResult }
  })

  res.json({
    id: result.burial.id,
    caseId: caseData.id,
    deceasedName: result.burial.deceasedName,
    deceasedAddress: result.burial.deceasedAddress ?? null,
    deceasedAge: result.burial.deceasedAge ?? null,
    deceasedOccupation: result.burial.deceasedOccupation ?? null,
    deceasedCivilStatus: result.burial.deceasedCivilStatus ?? null,
    deceasedSex: result.burial.deceasedSex ?? null,
    dateOfDeath: result.burial.dateOfDeath?.toISOString().slice(0, 10) ?? null,
    causeOfDeath: result.burial.causeOfDeath,
    funeralHome: result.burial.funeralHome,
    funeralHomeOwner: result.burial.funeralHomeOwner ?? null,
    funeralOwnerAddress: result.burial.funeralOwnerAddress ?? null,
    typeOfBill: result.burial.typeOfBill ?? null,
    intermentPlace: result.burial.intermentPlace ?? null,
    conformeName: result.burial.conformeName ?? null,
    conformeRelationship: result.burial.conformeRelationship ?? null,
    guaranteeLetterUrl: result.burial.guaranteeLetterUrl,
    signedGlUrl: result.burial.signedGlUrl,
    amount,
    status: result.resetResult.status ?? caseData.status,
    approvalsReset: result.resetResult.approvalsReset,
  })
}

export async function uploadBurialGl(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const file = req.file
  if (!file) throw new HttpError(400, 'No file uploaded')
  try {
    await validateStoredUpload(file, 'signedGl')

    const caseData = await prisma.case.findUnique({ where: { id: caseId } })
    if (!caseData) throw new HttpError(404, 'Case not found')
    assertCaseReadable(caseData, req.user, 'Signed guarantee letter upload')
    if (caseData.assistanceType !== 'burial') throw new HttpError(400, 'Only burial cases can upload signed GL')
    await assertSignedGlUploadAllowed(caseData, req.user)

    const signedGlUrl = signedGlPublicUrl(file.filename)
    const burial = await prisma.burialDetail.upsert({
      where: { caseId: caseData.id },
      update: { signedGlUrl, glUploadedAt: new Date() },
      create: { caseId: caseData.id, signedGlUrl, glUploadedAt: new Date() },
    })
    res.status(201).json({ signedGlUrl: burial.signedGlUrl, glUploadedAt: burial.glUploadedAt })
  } catch (error) {
    await removeStoredUpload(file)
    throw error
  }
}

// ── Hospital ────────────────────────────────────────────────────────────────

export async function getHospital(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { hospitalDetails: true, client: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Hospital details')

  res.json({
    caseId: caseData.id,
    caseNumber: caseData.caseNumber ?? caseData.client.caseNumber,
    amount: currencyFromDb(caseData.amount),
    hospitalDetails: caseData.hospitalDetails
      ? {
          id: caseData.hospitalDetails.id,
          templateType: caseData.hospitalDetails.templateType,
          patientName: caseData.hospitalDetails.patientName ?? null,
          hospitalName: caseData.hospitalDetails.hospitalName ?? null,
          hospitalAddress: caseData.hospitalDetails.hospitalAddress ?? null,
          doctorName: caseData.hospitalDetails.doctorName ?? null,
          mdPosition: caseData.hospitalDetails.mdPosition ?? null,
          admissionDate: caseData.hospitalDetails.admissionDate?.toISOString().slice(0, 10) ?? null,
          diagnosis: caseData.hospitalDetails.diagnosis ?? null,
          typeOfBill: caseData.hospitalDetails.typeOfBill ?? null,
          conformeName: caseData.hospitalDetails.conformeName ?? null,
          conformeRelationship: caseData.hospitalDetails.conformeRelationship ?? null,
          guaranteeLetterUrl: caseData.hospitalDetails.guaranteeLetterUrl ?? null,
          signedGlUrl: caseData.hospitalDetails.signedGlUrl ?? null,
          glUploadedAt: caseData.hospitalDetails.glUploadedAt ?? null,
        }
      : null,
  })
}

export async function updateHospital(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = updateHospitalSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true, hospitalDetails: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Hospital details')
  if (caseData.assistanceType !== 'hospital') throw new HttpError(400, 'Only hospital cases can store hospital details')

  const amount =
    body.amount == null || (typeof body.amount === 'string' && body.amount.trim() === '')
      ? currencyFromDb(caseData.amount)
      : parseCurrencyAmount(body.amount)
  if (amount > HOSPITAL_MEDICAL_GL_MAX_AMOUNT) {
    throw new HttpError(400, `Hospital amount cannot exceed PHP ${HOSPITAL_MEDICAL_GL_MAX_AMOUNT.toFixed(2)}`)
  }

  const guaranteeLetterUrl = `${env.apiBaseUrl}/api/cases/${caseData.id}/guarantee-letter/pdf`
  const nextAdmissionDate = body.admissionDate ? new Date(body.admissionDate) : body.admissionDate === null ? null : caseData.hospitalDetails?.admissionDate ?? null
  const changedFields: string[] = []
  addChangedField(changedFields, 'templateType', caseData.hospitalDetails?.templateType ?? 'personal', body.templateType ?? 'personal')
  addChangedField(changedFields, 'patientName', caseData.hospitalDetails?.patientName ?? null, body.patientName ?? null)
  addChangedField(changedFields, 'hospitalName', caseData.hospitalDetails?.hospitalName ?? null, body.hospitalName ?? null)
  addChangedField(changedFields, 'hospitalAddress', caseData.hospitalDetails?.hospitalAddress ?? null, body.hospitalAddress ?? null)
  addChangedField(changedFields, 'doctorName', caseData.hospitalDetails?.doctorName ?? null, body.doctorName ?? null)
  addChangedField(changedFields, 'mdPosition', caseData.hospitalDetails?.mdPosition ?? null, body.mdPosition ?? null)
  addChangedField(changedFields, 'admissionDate', caseData.hospitalDetails?.admissionDate?.toISOString().slice(0, 10) ?? null, nextAdmissionDate?.toISOString().slice(0, 10) ?? null)
  addChangedField(changedFields, 'diagnosis', caseData.hospitalDetails?.diagnosis ?? null, body.diagnosis ?? null)
  addChangedField(changedFields, 'typeOfBill', caseData.hospitalDetails?.typeOfBill ?? null, body.typeOfBill ?? null)
  addChangedField(changedFields, 'conformeName', caseData.hospitalDetails?.conformeName ?? null, body.conformeName ?? null)
  addChangedField(changedFields, 'conformeRelationship', caseData.hospitalDetails?.conformeRelationship ?? null, body.conformeRelationship ?? null)
  addChangedField(changedFields, 'amount', currencyFromDb(caseData.amount), amount)

  const result = await prisma.$transaction(async (tx) => {
    const hospital = await tx.hospitalDetail.upsert({
      where: { caseId: caseData.id },
      update: {
        templateType: body.templateType, patientName: body.patientName, hospitalName: body.hospitalName,
        hospitalAddress: body.hospitalAddress, doctorName: body.doctorName, mdPosition: body.mdPosition,
        admissionDate: body.admissionDate ? new Date(body.admissionDate) : body.admissionDate === null ? null : undefined,
        diagnosis: body.diagnosis, typeOfBill: body.typeOfBill, conformeName: body.conformeName,
        conformeRelationship: body.conformeRelationship, guaranteeLetterUrl,
        ...(shouldResetSignedGl(changedFields) ? { signedGlUrl: null, glUploadedAt: null } : {}),
      },
      create: {
        caseId: caseData.id, templateType: body.templateType ?? 'personal',
        patientName: body.patientName ?? null, hospitalName: body.hospitalName ?? null,
        hospitalAddress: body.hospitalAddress ?? null, doctorName: body.doctorName ?? null,
        mdPosition: body.mdPosition ?? null,
        admissionDate: body.admissionDate ? new Date(body.admissionDate) : null,
        diagnosis: body.diagnosis ?? null, typeOfBill: body.typeOfBill ?? null,
        conformeName: body.conformeName ?? null, conformeRelationship: body.conformeRelationship ?? null,
        guaranteeLetterUrl,
      },
    })
    await tx.case.update({ where: { id: caseData.id }, data: { amount } })
    const resetResult = await resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields,
    })
    return { hospital, resetResult }
  })

  res.json({
    id: result.hospital.id, caseId: caseData.id, templateType: result.hospital.templateType,
    patientName: result.hospital.patientName ?? null, hospitalName: result.hospital.hospitalName ?? null,
    hospitalAddress: result.hospital.hospitalAddress ?? null, doctorName: result.hospital.doctorName ?? null,
    mdPosition: result.hospital.mdPosition ?? null, admissionDate: result.hospital.admissionDate?.toISOString().slice(0, 10) ?? null,
    diagnosis: result.hospital.diagnosis ?? null, typeOfBill: result.hospital.typeOfBill ?? null,
    conformeName: result.hospital.conformeName ?? null, conformeRelationship: result.hospital.conformeRelationship ?? null,
    guaranteeLetterUrl: result.hospital.guaranteeLetterUrl ?? null, signedGlUrl: result.hospital.signedGlUrl ?? null, amount,
    status: result.resetResult.status ?? caseData.status,
    approvalsReset: result.resetResult.approvalsReset,
  })
}

export async function uploadHospitalGl(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const file = req.file
  if (!file) throw new HttpError(400, 'No file uploaded')
  try {
    await validateStoredUpload(file, 'signedGl')

    const caseData = await prisma.case.findUnique({ where: { id: caseId } })
    if (!caseData) throw new HttpError(404, 'Case not found')
    assertCaseReadable(caseData, req.user, 'Signed guarantee letter upload')
    if (caseData.assistanceType !== 'hospital') throw new HttpError(400, 'Only hospital cases can upload signed GL')
    await assertSignedGlUploadAllowed(caseData, req.user)

    const signedGlUrl = signedGlPublicUrl(file.filename)
    const hospital = await prisma.hospitalDetail.upsert({
      where: { caseId: caseData.id },
      update: { signedGlUrl, glUploadedAt: new Date() },
      create: { caseId: caseData.id, signedGlUrl, glUploadedAt: new Date() },
    })
    res.status(201).json({ signedGlUrl: hospital.signedGlUrl, glUploadedAt: hospital.glUploadedAt })
  } catch (error) {
    await removeStoredUpload(file)
    throw error
  }
}

// ── Medical ─────────────────────────────────────────────────────────────────

export async function updateMedical(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = updateMedicalSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true, medicalDetails: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Medical details')
  if (caseData.assistanceType !== 'medical') throw new HttpError(400, 'Only medical cases can store medical details')

  const amount =
    body.amount == null || (typeof body.amount === 'string' && body.amount.trim() === '')
      ? currencyFromDb(caseData.amount)
      : parseCurrencyAmount(body.amount)
  if (amount > HOSPITAL_MEDICAL_GL_MAX_AMOUNT) {
    throw new HttpError(400, `Medical amount cannot exceed PHP ${HOSPITAL_MEDICAL_GL_MAX_AMOUNT.toFixed(2)}`)
  }

  const guaranteeLetterUrl = `${env.apiBaseUrl}/api/cases/${caseData.id}/guarantee-letter/pdf`
  const nextConsultationDate = body.consultationDate ? new Date(body.consultationDate) : body.consultationDate === null ? null : caseData.medicalDetails?.consultationDate ?? null
  const medicalChangedFields: string[] = []
  addChangedField(medicalChangedFields, 'templateType', caseData.medicalDetails?.templateType ?? 'personal', body.templateType ?? 'personal')
  addChangedField(medicalChangedFields, 'clinicName', caseData.medicalDetails?.clinicName ?? null, body.clinicName ?? null)
  addChangedField(medicalChangedFields, 'clinicAddress', caseData.medicalDetails?.clinicAddress ?? null, body.clinicAddress ?? null)
  addChangedField(medicalChangedFields, 'doctorName', caseData.medicalDetails?.doctorName ?? null, body.doctorName ?? null)
  addChangedField(medicalChangedFields, 'mdPosition', caseData.medicalDetails?.mdPosition ?? null, body.mdPosition ?? null)
  addChangedField(medicalChangedFields, 'consultationDate', caseData.medicalDetails?.consultationDate?.toISOString().slice(0, 10) ?? null, nextConsultationDate?.toISOString().slice(0, 10) ?? null)
  addChangedField(medicalChangedFields, 'medicalType', caseData.medicalDetails?.medicalType ?? null, body.medicalType ?? null)
  addChangedField(medicalChangedFields, 'diagnosedType', caseData.medicalDetails?.diagnosedType ?? null, body.diagnosedType ?? null)
  addChangedField(medicalChangedFields, 'operationType', caseData.medicalDetails?.operationType ?? null, body.operationType ?? null)
  addChangedField(medicalChangedFields, 'diagnosis', caseData.medicalDetails?.diagnosis ?? null, body.diagnosis ?? null)
  addChangedField(medicalChangedFields, 'typeOfBill', caseData.medicalDetails?.typeOfBill ?? null, body.typeOfBill ?? null)
  addChangedField(medicalChangedFields, 'conformeName', caseData.medicalDetails?.conformeName ?? null, body.conformeName ?? null)
  addChangedField(medicalChangedFields, 'conformeRelationship', caseData.medicalDetails?.conformeRelationship ?? null, body.conformeRelationship ?? null)
  addChangedField(medicalChangedFields, 'amount', currencyFromDb(caseData.amount), amount)

  const medicalResult = await prisma.$transaction(async (tx) => {
    const medical = await tx.medicalDetail.upsert({
      where: { caseId: caseData.id },
      update: {
        templateType: body.templateType, clinicName: body.clinicName, clinicAddress: body.clinicAddress,
        doctorName: body.doctorName, mdPosition: body.mdPosition,
        consultationDate: body.consultationDate ? new Date(body.consultationDate) : body.consultationDate === null ? null : undefined,
        medicalType: body.medicalType, diagnosedType: body.diagnosedType, operationType: body.operationType,
        diagnosis: body.diagnosis, typeOfBill: body.typeOfBill, conformeName: body.conformeName,
        conformeRelationship: body.conformeRelationship, guaranteeLetterUrl,
        ...(shouldResetSignedGl(medicalChangedFields) ? { signedGlUrl: null, glUploadedAt: null } : {}),
      },
      create: {
        caseId: caseData.id, templateType: body.templateType ?? 'personal',
        clinicName: body.clinicName ?? null, clinicAddress: body.clinicAddress ?? null,
        doctorName: body.doctorName ?? null, mdPosition: body.mdPosition ?? null,
        consultationDate: body.consultationDate ? new Date(body.consultationDate) : null,
        medicalType: body.medicalType ?? null, diagnosedType: body.diagnosedType ?? null,
        operationType: body.operationType ?? null, diagnosis: body.diagnosis ?? null,
        typeOfBill: body.typeOfBill ?? null, conformeName: body.conformeName ?? null,
        conformeRelationship: body.conformeRelationship ?? null, guaranteeLetterUrl,
      },
    })
    await tx.case.update({ where: { id: caseData.id }, data: { amount } })
    const resetResult = await resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields: medicalChangedFields,
    })
    return { medical, resetResult }
  })

  res.json({
    id: medicalResult.medical.id, caseId: caseData.id, templateType: medicalResult.medical.templateType,
    clinicName: medicalResult.medical.clinicName ?? null, clinicAddress: medicalResult.medical.clinicAddress ?? null,
    doctorName: medicalResult.medical.doctorName ?? null, mdPosition: medicalResult.medical.mdPosition ?? null,
    consultationDate: medicalResult.medical.consultationDate?.toISOString().slice(0, 10) ?? null,
    medicalType: medicalResult.medical.medicalType ?? null, diagnosedType: medicalResult.medical.diagnosedType ?? null,
    operationType: medicalResult.medical.operationType ?? null, diagnosis: medicalResult.medical.diagnosis ?? null,
    typeOfBill: medicalResult.medical.typeOfBill ?? null, conformeName: medicalResult.medical.conformeName ?? null,
    conformeRelationship: medicalResult.medical.conformeRelationship ?? null,
    guaranteeLetterUrl: medicalResult.medical.guaranteeLetterUrl ?? null, signedGlUrl: medicalResult.medical.signedGlUrl ?? null, amount,
    status: medicalResult.resetResult.status ?? caseData.status,
    approvalsReset: medicalResult.resetResult.approvalsReset,
  })
}

export async function uploadMedicalGl(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const file = req.file
  if (!file) throw new HttpError(400, 'No file uploaded')
  try {
    await validateStoredUpload(file, 'signedGl')

    const caseData = await prisma.case.findUnique({ where: { id: caseId } })
    if (!caseData) throw new HttpError(404, 'Case not found')
    assertCaseReadable(caseData, req.user, 'Signed guarantee letter upload')
    if (caseData.assistanceType !== 'medical') throw new HttpError(400, 'Only medical cases can upload signed GL')
    await assertSignedGlUploadAllowed(caseData, req.user)

    const signedGlUrl = signedGlPublicUrl(file.filename)
    const medical = await prisma.medicalDetail.upsert({
      where: { caseId: caseData.id },
      update: { signedGlUrl, glUploadedAt: new Date() },
      create: { caseId: caseData.id, signedGlUrl, glUploadedAt: new Date() },
    })
    res.status(201).json({ signedGlUrl: medical.signedGlUrl, glUploadedAt: medical.glUploadedAt })
  } catch (error) {
    await removeStoredUpload(file)
    throw error
  }
}

// ── Eyeglass ────────────────────────────────────────────────────────────────

export async function updateEyeglass(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = updateEyeglassSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true, eyeglassDetails: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Eyeglass details')
  if (caseData.assistanceType !== 'eyeglass') throw new HttpError(400, 'Only eyeglass cases can store eyeglass details')

  const amount =
    body.amount == null || (typeof body.amount === 'string' && body.amount.trim() === '')
      ? currencyFromDb(caseData.amount)
      : parseCurrencyAmount(body.amount)
  if (amount > env.hospitalGlMaxAmount) {
    throw new HttpError(400, `Eyeglass amount cannot exceed PHP ${env.hospitalGlMaxAmount.toFixed(2)}`)
  }

  const guaranteeLetterUrl = `${env.apiBaseUrl}/api/cases/${caseData.id}/guarantee-letter/pdf`
  const eyeglassChangedFields: string[] = []
  addChangedField(eyeglassChangedFields, 'doctorName', caseData.eyeglassDetails?.doctorName ?? null, body.doctorName ?? null)
  addChangedField(eyeglassChangedFields, 'clinicName', caseData.eyeglassDetails?.clinicName ?? null, body.clinicName ?? null)
  addChangedField(eyeglassChangedFields, 'clinicAddress', caseData.eyeglassDetails?.clinicAddress ?? null, body.clinicAddress ?? null)
  addChangedField(eyeglassChangedFields, 'conformeName', caseData.eyeglassDetails?.conformeName ?? null, body.conformeName ?? null)
  addChangedField(eyeglassChangedFields, 'conformeRelationship', caseData.eyeglassDetails?.conformeRelationship ?? null, body.conformeRelationship ?? null)
  addChangedField(eyeglassChangedFields, 'amount', currencyFromDb(caseData.amount), amount)

  const eyeglassResult = await prisma.$transaction(async (tx) => {
    const eyeglass = await tx.eyeglassDetail.upsert({
      where: { caseId: caseData.id },
      update: { doctorName: body.doctorName, clinicName: body.clinicName, clinicAddress: body.clinicAddress, conformeName: body.conformeName, conformeRelationship: body.conformeRelationship, guaranteeLetterUrl },
      create: { caseId: caseData.id, doctorName: body.doctorName ?? null, clinicName: body.clinicName ?? null, clinicAddress: body.clinicAddress ?? null, conformeName: body.conformeName ?? null, conformeRelationship: body.conformeRelationship ?? null, guaranteeLetterUrl },
    })
    await tx.case.update({ where: { id: caseData.id }, data: { amount } })
    const resetResult = await resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields: eyeglassChangedFields,
    })
    return { eyeglass, resetResult }
  })

  res.json({ id: eyeglassResult.eyeglass.id, caseId: caseData.id, doctorName: eyeglassResult.eyeglass.doctorName ?? null, clinicName: eyeglassResult.eyeglass.clinicName ?? null, clinicAddress: eyeglassResult.eyeglass.clinicAddress ?? null, conformeName: eyeglassResult.eyeglass.conformeName ?? null, conformeRelationship: eyeglassResult.eyeglass.conformeRelationship ?? null, guaranteeLetterUrl: eyeglassResult.eyeglass.guaranteeLetterUrl ?? null, signedGlUrl: eyeglassResult.eyeglass.signedGlUrl ?? null, amount, status: eyeglassResult.resetResult.status ?? caseData.status, approvalsReset: eyeglassResult.resetResult.approvalsReset })
}

// ── Plain ───────────────────────────────────────────────────────────────────

export async function updatePlain(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = updatePlainSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { plainDetails: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Plain details')
  if (caseData.assistanceType !== 'plain') throw new HttpError(400, 'Only plain cases can store plain details')

  const currentAuditFlags =
    typeof caseData.auditFlags === 'object' && caseData.auditFlags && !Array.isArray(caseData.auditFlags)
      ? { ...(caseData.auditFlags as Record<string, unknown>) }
      : {}
  const currentAssistanceKinds = normalizePlainAssistanceKinds(currentAuditFlags.plain_assistance_kinds)
  const nextAssistanceKinds = normalizePlainAssistanceKinds(body.assistanceKinds)
  const currentConformeName = typeof currentAuditFlags.plain_conforme_name === 'string' ? currentAuditFlags.plain_conforme_name : null
  const currentConformeRelationship = typeof currentAuditFlags.plain_conforme_relationship === 'string' ? currentAuditFlags.plain_conforme_relationship : null
  const nextConformeName = typeof body.conformeName === 'string' && body.conformeName.trim() ? body.conformeName.trim() : null
  const nextConformeRelationship = typeof body.conformeRelationship === 'string' && body.conformeRelationship.trim() ? body.conformeRelationship.trim() : null

  const plainChangedFields: string[] = []
  addChangedField(plainChangedFields, 'natureOfAssistance', caseData.plainDetails?.natureOfAssistance ?? null, body.natureOfAssistance ?? null)
  addChangedField(plainChangedFields, 'conformeName', currentConformeName, nextConformeName)
  addChangedField(plainChangedFields, 'conformeRelationship', currentConformeRelationship, nextConformeRelationship)
  addChangedField(plainChangedFields, 'assistanceKinds', currentAssistanceKinds, nextAssistanceKinds)
  if (body.amount !== undefined) {
    addChangedField(plainChangedFields, 'amount', currencyFromDb(caseData.amount), body.amount)
  }
  const plainResult = await prisma.$transaction(async (tx) => {
    await tx.plainDetail.upsert({
      where: { caseId: caseData.id },
      create: { caseId: caseData.id, natureOfAssistance: body.natureOfAssistance },
      update: { natureOfAssistance: body.natureOfAssistance },
    })
    const nextAuditFlags = { ...currentAuditFlags }
    if (nextAssistanceKinds.length > 0) nextAuditFlags.plain_assistance_kinds = nextAssistanceKinds
    else delete nextAuditFlags.plain_assistance_kinds
    if (nextConformeName) nextAuditFlags.plain_conforme_name = nextConformeName
    else delete nextAuditFlags.plain_conforme_name
    if (nextConformeRelationship) nextAuditFlags.plain_conforme_relationship = nextConformeRelationship
    else delete nextAuditFlags.plain_conforme_relationship

    const caseUpdateData: Record<string, unknown> = {}
    if (body.amount !== undefined) {
      caseUpdateData.amount = body.amount
    }
    if (
      valuesDiffer(currentAssistanceKinds, nextAssistanceKinds)
      || valuesDiffer(currentConformeName, nextConformeName)
      || valuesDiffer(currentConformeRelationship, nextConformeRelationship)
    ) {
      caseUpdateData.auditFlags = nextAuditFlags as any
    }
    if (Object.keys(caseUpdateData).length > 0) {
      await tx.case.update({ where: { id: caseData.id }, data: caseUpdateData as any })
    }
    const resetResult = await resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields: plainChangedFields,
    })
    return { resetResult }
  })
  res.json({ ok: true, amount: body.amount, status: plainResult.resetResult.status ?? caseData.status, approvalsReset: plainResult.resetResult.approvalsReset })
}
