import { AssistanceType } from '@prisma/client'

export const REQUIREMENT_DEFINITIONS: Record<AssistanceType, Array<{ key: string; label: string }>> = {
  medicine: [
    { key: 'personal_letter', label: 'Letter Request' },
    { key: 'medical_cert', label: 'Medical Certificate' },
    { key: 'prescription', label: 'Prescription' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
    { key: 'cho_cert', label: 'Certificate of No Available Medicine as Prescribed' },
  ],
  burial: [
    { key: 'death_cert', label: 'Certified True Copy of Death Certificate' },
    { key: 'billing_stmt', label: 'Billing Statement/Statement of Account' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
  ],
  hospital: [
    { key: 'clinical_abstract', label: 'Clinical Abstract' },
    { key: 'final_bill', label: 'Final Bill' },
    { key: 'promissory_note', label: 'Promissory Note' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
  ],
  medical: [
    { key: 'med_request', label: 'Request Form' },
    { key: 'medical_cert', label: 'Medical Certificate' },
    { key: 'price_quotation', label: 'Price Quotation' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
  ],
  eyeglass: [
    { key: 'prescription', label: 'Prescription' },
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
  ],
  plain: [
    { key: 'indigency', label: 'Certificate of Indigency' },
    { key: 'id_copy', label: 'Photocopy of ID' },
    { key: 'sales_invoice', label: 'Sales Invoice' },
  ],
}

const PLAIN_ASSISTANCE_REQUIREMENT_TYPES: AssistanceType[] = ['medical', 'hospital', 'burial']

export function normalizePlainAssistanceKinds(value: unknown): AssistanceType[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>(PLAIN_ASSISTANCE_REQUIREMENT_TYPES)
  return [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowed.has(item))
  )] as AssistanceType[]
}

export function requirementDefinitionsForType(
  type: AssistanceType,
  plainAssistanceKinds: AssistanceType[] = [],
) {
  if (type !== 'plain') return REQUIREMENT_DEFINITIONS[type]

  const merged = [
    ...REQUIREMENT_DEFINITIONS.plain,
    ...plainAssistanceKinds.flatMap((kind) => REQUIREMENT_DEFINITIONS[kind] ?? []),
  ]
  const seen = new Set<string>()
  return merged.filter((requirement) => {
    if (seen.has(requirement.key)) return false
    seen.add(requirement.key)
    return true
  })
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
    'statement of account': 'billing_stmt',
    'hospital bill or statement of account': 'billing_stmt',
    'hospital admission papers': 'billing_stmt',
  },
  burial: {
    'valid government id': 'id_copy',
    'death certificate': 'death_cert',
    'funeral contract or statement of account': 'final_bill',
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
    'sales invoice': 'sales_invoice',
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

export function emptyRequirementMap(type: AssistanceType, plainAssistanceKinds: AssistanceType[] = []): Record<string, boolean> {
  return Object.fromEntries(requirementDefinitionsForType(type, plainAssistanceKinds).map((r) => [r.key, false]))
}


