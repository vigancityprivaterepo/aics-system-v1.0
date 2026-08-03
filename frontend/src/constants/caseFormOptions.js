export const OTHER_OPTION_VALUE = '__other__'

export const RELATIONSHIP_OPTIONS = [
  'Self',
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Grandson',
  'Granddaughter',
  'Grandfather',
  'Grandmother',
  'Uncle',
  'Aunt',
  'Nephew',
  'Niece',
  'Son-in-Law',
  'Daughter-in-Law',
  'Father-in-Law',
  'Mother-in-Law',
]

export const DOCTOR_POSITION_OPTIONS = [
  'MD',
  'Attending Physician',
  'Resident Physician',
  'Consultant',
  'Surgeon',
  'Pediatrician',
  'OB-GYNE',
  'Orthopedic Surgeon',
  'Cardiologist',
  'City Health Officer I',
  'City Health Officer II',
  'City Health Officer III',
  'City Health Officer IV',
  'City Health Officer V',
]

export const MEDICAL_BILL_TYPE_OPTIONS = [
  'Consultation Fee',
  'Professional Fee',
  'Laboratory Fee',
  'Diagnostic Procedure',
  'Medical Procedure',
]

export const OCCUPATION_OPTIONS = [
  'Unemployed',
  'Self-Employed',
  'Vendor',
  'Farmer',
  'Fisherman',
  'Laborer',
  'Construction Worker',
  'Driver',
  'Housewife',
  'Housekeeper',
  'Student',
  'Senior Citizen',
  'Government Employee',
  'Private Employee',
  'Security Guard',
  'Barangay Worker',
  'OFW',
  'Seafarer',
  'Tricycle Driver',
  'Pensioner',
]

export const MEDICAL_PROCEDURE_OPTIONS = [
  'Medical consultation',
  'Medical examination',
  'Laboratory examination',
  'Diagnostic procedure',
  'X-ray examination',
  'Ultrasound examination',
  'CT scan',
  'MRI',
  'ECG',
  'Hemodialysis',
  'Out-patient procedure',
  'Surgical procedure',
  'Minor operation',
  'Major operation',
]

export const HOSPITAL_BILL_TYPE_OPTIONS = [
  'Hospital Bill',
  'Room Charges',
  'Professional Fee',
  'Laboratory Charges',
  'Medicine Charges',
]

export const BURIAL_BILL_TYPE_OPTIONS = [
  'Funeral Bill',
  'Funeral Service Fee',
  'Embalming Fee',
  'Casket Fee',
  'Burial Assistance Fee',
]

export function resolvePresetSelection(value, options) {
  const normalizedValue = String(value ?? '').trim()
  if (!normalizedValue) return ''
  if (normalizedValue.toLowerCase() === 'other') return OTHER_OPTION_VALUE
  return options.includes(normalizedValue) ? normalizedValue : OTHER_OPTION_VALUE
}
