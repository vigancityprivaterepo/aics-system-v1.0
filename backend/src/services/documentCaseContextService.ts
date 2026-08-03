import { richTextToPlainText } from '../utils/richText.js'

function textOrNull(value: unknown): string | null {
  if (value == null) return null
  const normalized = richTextToPlainText(value).trim()
  return normalized.length > 0 ? normalized : null
}

export function resolveMedicalRequestedAssistance(caseData: any): string | null {
  const medical = caseData?.medicalDetails ?? {}
  const portal = caseData?.portalApplicationContext ?? {}
  return (
    textOrNull(medical.medicalType)
    ?? textOrNull(medical.operationType)
    ?? textOrNull(portal.medicalRequestedAssistance)
    ?? textOrNull(portal.medicalType)
    ?? textOrNull(portal.operationType)
  )
}

export function resolveAssistancePurpose(caseData: any): string | null {
  switch (caseData?.assistanceType) {
    case 'hospital':
      return 'payment of hospitalization expenses'
    case 'medical':
      return resolveMedicalRequestedAssistance(caseData) ?? 'medical procedure/examination'
    case 'eyeglass':
      return 'purchase of eyeglasses'
    case 'medicine':
      return 'purchase of maintenance medications'
    case 'burial':
      return 'burial/funeral expenses'
    case 'plain':
      return textOrNull(caseData?.plainDetails?.natureOfAssistance) ?? 'emergency assistance'
    default:
      return 'emergency assistance'
  }
}

export function resolveServiceProviderName(caseData: any): string | null {
  switch (caseData?.assistanceType) {
    case 'burial':
      return textOrNull(caseData?.burialDetails?.funeralHome)
    case 'hospital':
      return textOrNull(caseData?.hospitalDetails?.hospitalName)
    case 'medical':
      return textOrNull(caseData?.medicalDetails?.clinicName)
    case 'eyeglass':
      return textOrNull(caseData?.eyeglassDetails?.clinicName)
    default:
      return textOrNull(caseData?.serviceProviderName)
  }
}

export function resolveServiceProviderAddress(caseData: any): string | null {
  switch (caseData?.assistanceType) {
    case 'burial':
      return textOrNull(caseData?.burialDetails?.funeralOwnerAddress)
    case 'hospital':
      return textOrNull(caseData?.hospitalDetails?.hospitalAddress)
    case 'medical':
      return textOrNull(caseData?.medicalDetails?.clinicAddress)
    case 'eyeglass':
      return textOrNull(caseData?.eyeglassDetails?.clinicAddress)
    default:
      return textOrNull(caseData?.serviceProviderAddress)
  }
}
