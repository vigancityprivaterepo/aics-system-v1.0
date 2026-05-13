import type { Request, Response } from 'express'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { env } from '../config/env.js'
import { currencyFromDb, parseCurrencyAmount, toOptionalInt } from '../utils/currency.js'
import { assertCaseReadable, assertEditableCase, paramId } from '../services/caseService.js'
import { signedGlPublicUrl } from '../services/storageService.js'
import { updateBurialSchema, updateHospitalSchema, updateMedicalSchema, updateEyeglassSchema, updatePlainSchema } from '../schemas/caseSchemas.js'
import { removeStoredUpload, validateStoredUpload } from '../services/uploadValidation.js'

// ── Burial ─────────────────────────────────────────────────────────────────

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
      [caseData.client.barangay, caseData.client.municipality, caseData.client.province, caseData.client.region].filter(Boolean).join(', '),
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

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true } })
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

  const burial = await prisma.burialDetail.upsert({
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
  await prisma.case.update({ where: { id: caseData.id }, data: { amount } })

  res.json({
    id: burial.id,
    caseId: caseData.id,
    deceasedName: burial.deceasedName,
    deceasedAddress: burial.deceasedAddress ?? null,
    deceasedAge: burial.deceasedAge ?? null,
    deceasedOccupation: burial.deceasedOccupation ?? null,
    deceasedCivilStatus: burial.deceasedCivilStatus ?? null,
    deceasedSex: burial.deceasedSex ?? null,
    dateOfDeath: burial.dateOfDeath?.toISOString().slice(0, 10) ?? null,
    causeOfDeath: burial.causeOfDeath,
    funeralHome: burial.funeralHome,
    funeralHomeOwner: burial.funeralHomeOwner ?? null,
    funeralOwnerAddress: burial.funeralOwnerAddress ?? null,
    typeOfBill: burial.typeOfBill ?? null,
    intermentPlace: burial.intermentPlace ?? null,
    conformeName: burial.conformeName ?? null,
    conformeRelationship: burial.conformeRelationship ?? null,
    guaranteeLetterUrl: burial.guaranteeLetterUrl,
    signedGlUrl: burial.signedGlUrl,
    amount,
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
    if (caseData.status === 'released' || caseData.status === 'rejected') {
      throw new HttpError(400, `Signed guarantee letter cannot be uploaded when case is ${caseData.status}.`)
    }

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

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Hospital details')
  if (caseData.assistanceType !== 'hospital') throw new HttpError(400, 'Only hospital cases can store hospital details')

  const amount =
    body.amount == null || (typeof body.amount === 'string' && body.amount.trim() === '')
      ? currencyFromDb(caseData.amount)
      : parseCurrencyAmount(body.amount)
  if (amount > env.hospitalGlMaxAmount) {
    throw new HttpError(400, `Hospital amount cannot exceed PHP ${env.hospitalGlMaxAmount.toFixed(2)}`)
  }

  const guaranteeLetterUrl = `${env.apiBaseUrl}/api/cases/${caseData.id}/guarantee-letter/pdf`
  const hospital = await prisma.hospitalDetail.upsert({
    where: { caseId: caseData.id },
    update: {
      templateType: body.templateType, patientName: body.patientName, hospitalName: body.hospitalName,
      hospitalAddress: body.hospitalAddress, doctorName: body.doctorName, mdPosition: body.mdPosition,
      admissionDate: body.admissionDate ? new Date(body.admissionDate) : body.admissionDate === null ? null : undefined,
      diagnosis: body.diagnosis, typeOfBill: body.typeOfBill, conformeName: body.conformeName,
      conformeRelationship: body.conformeRelationship, guaranteeLetterUrl,
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
  await prisma.case.update({ where: { id: caseData.id }, data: { amount } })

  res.json({
    id: hospital.id, caseId: caseData.id, templateType: hospital.templateType,
    patientName: hospital.patientName ?? null, hospitalName: hospital.hospitalName ?? null,
    hospitalAddress: hospital.hospitalAddress ?? null, doctorName: hospital.doctorName ?? null,
    mdPosition: hospital.mdPosition ?? null, admissionDate: hospital.admissionDate?.toISOString().slice(0, 10) ?? null,
    diagnosis: hospital.diagnosis ?? null, typeOfBill: hospital.typeOfBill ?? null,
    conformeName: hospital.conformeName ?? null, conformeRelationship: hospital.conformeRelationship ?? null,
    guaranteeLetterUrl: hospital.guaranteeLetterUrl ?? null, signedGlUrl: hospital.signedGlUrl ?? null, amount,
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
    if (caseData.status === 'released' || caseData.status === 'rejected') {
      throw new HttpError(400, `Signed guarantee letter cannot be uploaded when case is ${caseData.status}.`)
    }

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

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Medical details')
  if (caseData.assistanceType !== 'medical') throw new HttpError(400, 'Only medical cases can store medical details')

  const amount =
    body.amount == null || (typeof body.amount === 'string' && body.amount.trim() === '')
      ? currencyFromDb(caseData.amount)
      : parseCurrencyAmount(body.amount)
  if (amount > env.hospitalGlMaxAmount) {
    throw new HttpError(400, `Medical amount cannot exceed PHP ${env.hospitalGlMaxAmount.toFixed(2)}`)
  }

  const guaranteeLetterUrl = `${env.apiBaseUrl}/api/cases/${caseData.id}/guarantee-letter/pdf`
  const medical = await prisma.medicalDetail.upsert({
    where: { caseId: caseData.id },
    update: {
      templateType: body.templateType, clinicName: body.clinicName, clinicAddress: body.clinicAddress,
      doctorName: body.doctorName, mdPosition: body.mdPosition,
      consultationDate: body.consultationDate ? new Date(body.consultationDate) : body.consultationDate === null ? null : undefined,
      medicalType: body.medicalType, diagnosedType: body.diagnosedType, operationType: body.operationType,
      diagnosis: body.diagnosis, typeOfBill: body.typeOfBill, conformeName: body.conformeName,
      conformeRelationship: body.conformeRelationship, guaranteeLetterUrl,
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
  await prisma.case.update({ where: { id: caseData.id }, data: { amount } })

  res.json({
    id: medical.id, caseId: caseData.id, templateType: medical.templateType,
    clinicName: medical.clinicName ?? null, clinicAddress: medical.clinicAddress ?? null,
    doctorName: medical.doctorName ?? null, mdPosition: medical.mdPosition ?? null,
    consultationDate: medical.consultationDate?.toISOString().slice(0, 10) ?? null,
    medicalType: medical.medicalType ?? null, diagnosedType: medical.diagnosedType ?? null,
    operationType: medical.operationType ?? null, diagnosis: medical.diagnosis ?? null,
    typeOfBill: medical.typeOfBill ?? null, conformeName: medical.conformeName ?? null,
    conformeRelationship: medical.conformeRelationship ?? null,
    guaranteeLetterUrl: medical.guaranteeLetterUrl ?? null, signedGlUrl: medical.signedGlUrl ?? null, amount,
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
    if (caseData.status === 'released' || caseData.status === 'rejected') {
      throw new HttpError(400, `Signed guarantee letter cannot be uploaded when case is ${caseData.status}.`)
    }

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

  const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { client: true } })
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
  const eyeglass = await prisma.eyeglassDetail.upsert({
    where: { caseId: caseData.id },
    update: { doctorName: body.doctorName, clinicName: body.clinicName, clinicAddress: body.clinicAddress, conformeName: body.conformeName, conformeRelationship: body.conformeRelationship, guaranteeLetterUrl },
    create: { caseId: caseData.id, doctorName: body.doctorName ?? null, clinicName: body.clinicName ?? null, clinicAddress: body.clinicAddress ?? null, conformeName: body.conformeName ?? null, conformeRelationship: body.conformeRelationship ?? null, guaranteeLetterUrl },
  })
  await prisma.case.update({ where: { id: caseData.id }, data: { amount } })

  res.json({ id: eyeglass.id, caseId: caseData.id, doctorName: eyeglass.doctorName ?? null, clinicName: eyeglass.clinicName ?? null, clinicAddress: eyeglass.clinicAddress ?? null, conformeName: eyeglass.conformeName ?? null, conformeRelationship: eyeglass.conformeRelationship ?? null, guaranteeLetterUrl: eyeglass.guaranteeLetterUrl ?? null, signedGlUrl: eyeglass.signedGlUrl ?? null, amount })
}

// ── Plain ───────────────────────────────────────────────────────────────────

export async function updatePlain(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = updatePlainSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Plain details')
  if (caseData.assistanceType !== 'plain') throw new HttpError(400, 'Only plain cases can store plain details')

  await prisma.plainDetail.upsert({
    where: { caseId: caseData.id },
    create: { caseId: caseData.id, natureOfAssistance: body.natureOfAssistance },
    update: { natureOfAssistance: body.natureOfAssistance },
  })
  if (body.amount !== undefined) {
    await prisma.case.update({ where: { id: caseData.id }, data: { amount: body.amount } })
  }
  res.json({ ok: true, amount: body.amount })
}
