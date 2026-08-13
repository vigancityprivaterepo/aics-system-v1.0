import { z } from 'zod'
import { normalizeNameOrNullish, normalizeFamilyCompositionNames } from '../utils/normalizeName.js'

export const createCaseSchema = z.object({
  clientId: z.string().uuid(),
  assistanceType: z.enum(['medicine', 'burial', 'hospital', 'medical', 'eyeglass', 'plain']),
  dateOfAssessment: z.string().optional().nullable(),
  presentingProblem: z.string().optional().nullable(),
  familyComposition: z.array(z.record(z.any())).optional().nullable().transform((members) => (members ? normalizeFamilyCompositionNames(members) : members)),
  backgroundOfProblem: z.string().optional().nullable(),
  assessment: z.string().optional().nullable(),
  recommendation: z.string().optional().nullable(),
  hospitalClinic: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  deceasedName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  dateOfDeath: z.string().optional().nullable(),
  causeOfDeath: z.string().optional().nullable(),
  funeralHome: z.string().optional().nullable(),
  funeralHomeOwner: z.string().optional().nullable(),
  funeralOwnerAddress: z.string().optional().nullable(),
  beneficiaryName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  beneficiaryAge: z.union([z.number(), z.string()]).optional().nullable(),
  beneficiarySex: z.string().optional().nullable(),
  beneficiaryCivilStatus: z.string().optional().nullable(),
  beneficiaryOccupation: z.string().optional().nullable(),
  beneficiaryRequestorName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  beneficiaryRequestorRelationship: z.string().optional().nullable(),
})

export const updateCaseSchema = z.object({
  dateOfAssessment: z.string().optional().nullable(),
  socialWorkerName: z.string().optional().nullable(),
  socialWorkerEmpId: z.string().optional().nullable(),
  presentingProblem: z.string().optional().nullable(),
  familyComposition: z.array(z.record(z.any())).optional().transform((members) => (members ? normalizeFamilyCompositionNames(members) : members)),
  backgroundOfProblem: z.string().optional().nullable(),
  assessment: z.string().optional().nullable(),
  recommendation: z.string().optional().nullable(),
  medicineTemplateType: z.enum(['personal', 'proxy']).optional().nullable(),
  eyeglassTemplateType: z.enum(['personal', 'proxy']).optional().nullable(),
  medicineConformeName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  medicineConformeRelationship: z.string().optional().nullable(),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
  overrideReason: z.string().optional().nullable(),
  hospitalClinic: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  beneficiaryName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  beneficiaryAge: z.union([z.number(), z.string()]).optional().nullable(),
  beneficiarySex: z.string().optional().nullable(),
  beneficiaryCivilStatus: z.string().optional().nullable(),
  beneficiaryOccupation: z.string().optional().nullable(),
  beneficiaryRequestorName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  beneficiaryRequestorRelationship: z.string().optional().nullable(),
})

export const updateStatusSchema = z.object({
  status: z.enum(['intake', 'encoding', 'for_review', 'recommending_approval', 'for_approval', 'approved', 'released', 'rejected']),
  notes: z.string().optional(),
  // Only meaningful when returning an active-approval-stage case to encoding: keep
  // already-completed earlier-stage approvals instead of wiping the whole trail, so
  // resubmitting resumes at the stage that sent it back instead of starting over.
  preserveApprovals: z.boolean().optional(),
})

export const updateRequirementsSchema = z.object({
  requirements: z.record(z.boolean()),
})

export const updateBurialSchema = z.object({
  deceasedName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  deceasedAddress: z.string().optional().nullable(),
  deceasedAge: z.union([z.number(), z.string()]).optional().nullable(),
  deceasedOccupation: z.string().optional().nullable(),
  deceasedCivilStatus: z.string().optional().nullable(),
  deceasedSex: z.string().optional().nullable(),
  dateOfDeath: z.string().optional().nullable(),
  causeOfDeath: z.string().optional().nullable(),
  funeralHome: z.string().optional().nullable(),
  funeralHomeOwner: z.string().optional().nullable(),
  funeralOwnerAddress: z.string().optional().nullable(),
  typeOfBill: z.string().optional().nullable(),
  intermentPlace: z.string().optional().nullable(),
  conformeName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  conformeRelationship: z.string().optional().nullable(),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
})

export const updateHospitalSchema = z.object({
  templateType: z.enum(['personal', 'proxy']).optional(),
  patientName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  hospitalName: z.string().optional().nullable(),
  hospitalAddress: z.string().optional().nullable(),
  doctorName: z.string().optional().nullable(),
  mdPosition: z.string().optional().nullable(),
  admissionDate: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  typeOfBill: z.string().optional().nullable(),
  conformeName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  conformeRelationship: z.string().optional().nullable(),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
})

export const updateMedicalSchema = z.object({
  templateType: z.enum(['personal', 'proxy']).optional(),
  clinicName: z.string().optional().nullable(),
  clinicAddress: z.string().optional().nullable(),
  doctorName: z.string().optional().nullable(),
  mdPosition: z.string().optional().nullable(),
  consultationDate: z.string().optional().nullable(),
  medicalType: z.string().optional().nullable(),
  diagnosedType: z.string().optional().nullable(),
  operationType: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  typeOfBill: z.string().optional().nullable(),
  conformeName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  conformeRelationship: z.string().optional().nullable(),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
})

export const updateEyeglassSchema = z.object({
  doctorName: z.string().optional().nullable(),
  clinicName: z.string().optional().nullable(),
  clinicAddress: z.string().optional().nullable(),
  conformeName: z.string().optional().nullable().transform(normalizeNameOrNullish),
  conformeRelationship: z.string().optional().nullable(),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
})

export const updatePlainSchema = z.object({
  natureOfAssistance: z.string().max(500).optional(),
  conformeName: z.string().max(200).optional().nullable().transform(normalizeNameOrNullish),
  conformeRelationship: z.string().max(100).optional().nullable(),
  assistanceKinds: z.array(z.enum(['medical', 'hospital', 'burial'])).max(3).optional(),
  amount: z.coerce.number().min(0).optional(),
})

export const saveMedicinesSchema = z.object({
  amount: z.union([z.number(), z.string()]).optional().nullable(),
  choCertGivenDate: z.string().optional().nullable(),
  medicines: z.array(z.object({
    medicineId: z.preprocess((val) => (val === '' ? null : val), z.string().uuid().optional().nullable()),
    medicineName: z.string().min(1),
    quantity: z.union([z.number(), z.string()]),
    unit: z.string().optional().nullable(),
    unitPrice: z.union([z.number(), z.string()]).optional().nullable(),
    totalPrice: z.union([z.number(), z.string()]).optional().nullable(),
  })),
})

export const patchRequirementSchema = z.object({
  isSubmitted: z.boolean(),
  notes: z.string().optional().nullable(),
})
