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

export function requirementLabelsByKey(type: AssistanceType): Record<string, string> {
  return Object.fromEntries(REQUIREMENT_DEFINITIONS[type].map((r) => [r.key, r.label]))
}

export function emptyRequirementMap(type: AssistanceType): Record<string, boolean> {
  return Object.fromEntries(REQUIREMENT_DEFINITIONS[type].map((r) => [r.key, false]))
}
