import { AssistanceType } from '@prisma/client'

export const REQUIREMENT_DEFINITIONS: Record<AssistanceType, Array<{ key: string; label: string }>> = {
  medicine: [
    { key: 'prescription', label: 'Prescription' },
    { key: 'medical_cert', label: 'Medical Certificate' },
    { key: 'cho_cert', label: 'Certificate of Unavailability (CHO)' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
    { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
    { key: 'acknowledgement', label: 'Acknowledgement/Certification' },
  ],
  burial: [
    { key: 'death_cert', label: 'Death Certificate' },
    { key: 'billing_stmt', label: 'Billing Statement' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
  ],
  hospital: [
    { key: 'hospital_bill', label: 'Hospital Billing Statement' },
    { key: 'medical_cert', label: 'Medical Certificate' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
  ],
  medical: [
    { key: 'med_request', label: 'Medical/Lab Request' },
    { key: 'medical_cert', label: 'Medical Certificate' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
    { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
  ],
  eyeglass: [
    { key: 'prescription',    label: 'Eyeglass Prescription' },
    { key: 'indigency',       label: 'Certificate of Indigency' },
    { key: 'id_copy',         label: 'Photocopy of ID' },
    { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
  ],
  plain: [
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
    { key: 'personal_letter', label: 'Personal Letter addressed to the LCE' },
  ],
}

const PORTAL_DOCUMENT_REQUIREMENT_MAP: Record<AssistanceType, Record<string, string>> = {
  medicine: {
    'valid government id': 'id_copy',
    'medical prescription': 'prescription',
    'barangay indigency certification': 'indigency',
  },
  medical: {
    'valid government id': 'id_copy',
    'medical certificate': 'medical_cert',
    'barangay indigency certification': 'indigency',
  },
  hospital: {
    'valid government id': 'id_copy',
    'statement of account': 'hospital_bill',
    'hospital bill or statement of account': 'hospital_bill',
    'hospital admission papers': 'hospital_bill',
  },
  burial: {
    'valid government id': 'id_copy',
    'death certificate': 'death_cert',
    'funeral contract or statement of account': 'billing_stmt',
    'barangay indigency certification': 'indigency',
  },
  eyeglass: {
    'valid government id': 'id_copy',
    'prescription for eyeglasses': 'prescription',
    'eye examination result': 'prescription',
    'barangay indigency certification': 'indigency',
  },
  plain: {
    'valid government id': 'id_copy',
    'letter of request or explanation': 'personal_letter',
    'barangay indigency certification': 'indigency',
  },
}

export function mapPortalDocumentTypeToRequirementKey(type: AssistanceType, documentType: string): string | null {
  const normalized = String(documentType || '').trim().toLowerCase()
  if (!normalized) return null
  return PORTAL_DOCUMENT_REQUIREMENT_MAP[type]?.[normalized] ?? null
}

export function buildPortalRequirementRows(
  type: AssistanceType,
  documents: Array<{ documentType: string; uploadedAt?: Date | string | null }> = [],
) {
  const matchedKeys = new Map<string, Date | null>()
  for (const document of documents) {
    const key = mapPortalDocumentTypeToRequirementKey(type, document.documentType)
    if (!key) continue
    const uploadedAt = document.uploadedAt ? new Date(document.uploadedAt) : new Date()
    matchedKeys.set(key, uploadedAt)
  }

  return REQUIREMENT_DEFINITIONS[type].map((requirement) => ({
    requirementName: requirement.key,
    isSubmitted: matchedKeys.has(requirement.key),
    submittedAt: matchedKeys.get(requirement.key) ?? null,
  }))
}

export function requirementLabelsByKey(type: AssistanceType): Record<string, string> {
  return Object.fromEntries(REQUIREMENT_DEFINITIONS[type].map((r) => [r.key, r.label]))
}

export function emptyRequirementMap(type: AssistanceType): Record<string, boolean> {
  return Object.fromEntries(REQUIREMENT_DEFINITIONS[type].map((r) => [r.key, false]))
}
