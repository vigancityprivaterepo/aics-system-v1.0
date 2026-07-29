import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { richTextToPlainText } from '../utils/richText.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ImageModule = require('../../vendor/docxtemplater-image-module-safe/index.cjs')
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', 'templates')
const GLOBAL_CASE_STUDY_TEMPLATE = 'CGV AICS Template.fixed.docx'

const CASE_STUDY_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Burial Case Study and GL', 'Burial Case Study.fixed.docx'),
]

const GL_CANDIDATES = [
  path.join('Burial Case Study and GL', 'Burial Case Study-Guarantee Letter.fixed.docx'),
  'Burial Case Study and GL.fixed.docx',
  'Burial Case Study and GL.docx',
]

const HOSPITAL_PERSONAL_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Hospital Case Study and GL', 'Hospital Case Study-PersonalCame.fixed.docx'),
]

const HOSPITAL_PROXY_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Hospital Case Study and GL', 'Hospital Case Study-Proxy.fixed.docx'),
]

const HOSPITAL_GL_CANDIDATES = [
  path.join('Hospital Case Study and GL', 'Hospital Case Study-Guarantee Letter.fixed.docx'),
  'Hospital GL.docx',
]

const MEDICINE_PERSONAL_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
]

const MEDICINE_PROXY_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
]

const MEDICINE_GL_CANDIDATES: string[] = [
  path.join('Medicine Case Study', 'Medicine Guarantee Letter.fixed.docx'),
  path.join('Medicine Case Study', 'Medicine GL.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine Guarantee Letter.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine GL.fixed.docx'),
]

const MEDICAL_PERSONAL_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Medical Case Study and GL', 'Medical Case Study-personal.fixed.docx'),
]

const MEDICAL_PROXY_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Medical Case Study and GL', 'Medical Case Study-proxy.fixed.docx'),
]

const MEDICAL_GL_CANDIDATES = [
  path.join('Medical Case Study and GL', 'Medical GL.fixed.docx'),
  'Medical GL.docx',
]

const EYEGLASS_PERSONAL_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Eyeglass Case Study and GL', 'Eyeglass case.fixed.docx'),
]

const EYEGLASS_PROXY_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Eyeglass Case Study and GL', 'Eyeglass case-proxy.fixed.docx'),
]

const EYEGLASS_ENDORSEMENT_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'Eyeglass-Endorsement.fixed.docx'),
]

const EYEGLASS_ACKNOWLEDGEMENT_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'eyeglass-acknowledgement.fixed.docx'),
]

const PLAIN_CASE_STUDY_CANDIDATES = [
  GLOBAL_CASE_STUDY_TEMPLATE,
  path.join('Plain AICS', 'PLAIN AICS.fixed.docx'),
  path.join('Plain AICS', 'PLAIN AICS.fixed.docx.patching.tmp'),
]

// Legacy combined template fallbacks
const COMBINED_CANDIDATES = [
  'Burial Case Study and GL.fixed.docx.tmp',
  'Burial Case Study and GL.fixed.docx',
  'Burial Case Study and GL.docx',
]

const SIGNATURE_PLACEHOLDER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nmJkAAAAASUVORK5CYII=',
  'base64'
)

function loadFirstAvailableTemplate(filenames: string[]): string {
  for (const filename of filenames) {
    const absolutePath = path.join(TEMPLATES_DIR, filename)
    if (fs.existsSync(absolutePath)) {
      return fs.readFileSync(absolutePath, 'binary')
    }
  }
  throw new Error(`Template not found. Tried: ${filenames.join(', ')}`)
}

function readSignatureImage(tagValue: unknown): Buffer {
  if (!tagValue) return SIGNATURE_PLACEHOLDER
  const raw = String(tagValue).trim()
  if (!raw) return SIGNATURE_PLACEHOLDER

  if (raw.startsWith('data:image/')) {
    const base64 = raw.split(',')[1]
    if (!base64) return SIGNATURE_PLACEHOLDER
    return Buffer.from(base64, 'base64')
  }

  const normalizedUploadsMarker = '/uploads/e-signatures/'
  const markerIndex = raw.indexOf(normalizedUploadsMarker)
  if (markerIndex >= 0) {
    const tail = raw.slice(markerIndex + normalizedUploadsMarker.length).split(/[?#]/)[0]
    const fileName = decodeURIComponent(tail)
    const abs = path.resolve(process.cwd(), 'uploads', 'e-signatures', fileName)
    if (fs.existsSync(abs)) return fs.readFileSync(abs)
    return SIGNATURE_PLACEHOLDER
  }

  if (path.isAbsolute(raw) && fs.existsSync(raw)) {
    return fs.readFileSync(raw)
  }

  return SIGNATURE_PLACEHOLDER
}

function fmt(value: unknown): string {
  if (value == null) return '-'
  const normalized = richTextToPlainText(value).trim()
  return normalized.length > 0 ? normalized : '-'
}

function pronounsFromSex(value: unknown): { heShe: string; hisHer: string; himHer: string } {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized.startsWith('f')) return { heShe: 'she', hisHer: 'her', himHer: 'her' }
  if (normalized.startsWith('m')) return { heShe: 'he', hisHer: 'his', himHer: 'him' }
  return { heShe: 'they', hisHer: 'their', himHer: 'them' }
}

function formatLongDate(value: unknown): string {
  if (value == null) return '-'
  const raw = String(value).trim()
  if (!raw) return '-'

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    const year = Number(ymdMatch[1])
    const month = Number(ymdMatch[2])
    const day = Number(ymdMatch[3])
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${months[month - 1]} ${day}, ${year}`
    }
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return '-'
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return String(age)
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
              'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
              'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function spellHundreds(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + spellHundreds(n % 100) : '')
}

function normalizeCurrency(value: unknown): number {
  const raw = typeof value === 'string' ? value.replace(/,/g, '').trim() : value
  const parsed = Number(raw ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.round((parsed + Number.EPSILON) * 100) / 100
}

function amountToWords(amount: number): string {
  const normalized = normalizeCurrency(amount)
  const totalCentavos = Math.round(normalized * 100)
  const pesos = Math.floor(totalCentavos / 100)
  const centavos = totalCentavos % 100
  const parts: string[] = []
  if (pesos >= 1_000_000) parts.push(spellHundreds(Math.floor(pesos / 1_000_000)) + ' Million')
  if (pesos >= 1_000) parts.push(spellHundreds(Math.floor((pesos % 1_000_000) / 1_000)) + ' Thousand')
  const rem = pesos % 1_000
  if (rem > 0) parts.push(spellHundreds(rem))
  const pesosWord = parts.filter(Boolean).join(' ') || 'Zero'
  const centWord = centavos > 0 ? ` and ${spellHundreds(centavos)}/100` : ' Only'
  return `${pesosWord} Pesos${centWord}`.toUpperCase()
}

function buildRenderData(caseData: any): Record<string, any> {
  const c = caseData.client
  const burial = caseData.burialDetails ?? {}
  const hospital = caseData.hospitalDetails ?? {}
  const medical = caseData.medicalDetails ?? {}
  const eyeglass = caseData.eyeglassDetails ?? {}
  const medicine = caseData.medicineDetails ?? {}
  const amount = normalizeCurrency(caseData.amount ?? 0)
  const textOrNull = (value: unknown): string | null => {
    if (value == null) return null
    const normalized = richTextToPlainText(value).trim()
    return normalized.length > 0 ? normalized : null
  }
  const resolvedClientSex =
    textOrNull(c.sex)
    ?? textOrNull((caseData as any).applicantApplication?.applicant?.sex)
  const clientPronouns = pronounsFromSex(resolvedClientSex)
  const burialPronouns = pronounsFromSex((burial as any).deceasedSex ?? resolvedClientSex)
  const activePronouns = caseData.assistanceType === 'burial' ? burialPronouns : clientPronouns
  const resolvedHospitalName = fmt(
    textOrNull(hospital.hospitalName)
    ?? textOrNull(medical.clinicName)
    ?? textOrNull(caseData.hospitalClinic)
  )
  const resolvedHospitalAddress = fmt(
    textOrNull(hospital.hospitalAddress)
    ?? textOrNull(medical.clinicAddress)
  )
  const resolvedDoctorName = fmt(
    textOrNull(hospital.doctorName) ?? textOrNull(medical.doctorName)
  )
  const resolvedMdPosition = fmt(
    textOrNull(hospital.mdPosition) ?? textOrNull(medical.mdPosition)
  )
  const resolvedAdmissionDate = formatLongDate(
    textOrNull(hospital.admissionDate) ?? textOrNull(caseData.dateOfAssessment)
  )
  const resolvedDiagnosis = fmt(
    textOrNull(hospital.diagnosis) ?? textOrNull(medical.diagnosis)
  )
  const resolvedHospitalizationType = String((hospital as any).hospitalizationType ?? '').trim() || 'hospitalized'
  const resolvedHospitalBill = fmt(textOrNull(hospital.typeOfBill))
  const medicineTemplateType = String((medicine as any).templateType ?? '').trim().toLowerCase() === 'proxy' ? 'proxy' : 'personal'
  const medicalTemplateType = String((medical as any).templateType ?? '').trim().toLowerCase() === 'proxy' ? 'proxy' : 'personal'
  const eyeglassTemplateType = String((eyeglass as any).templateType ?? '').trim().toLowerCase() === 'proxy' ? 'proxy' : 'personal'
  const resolvedClinicName = fmt(textOrNull(medical.clinicName) ?? textOrNull((eyeglass as any).clinicName) ?? textOrNull(caseData.hospitalClinic))
  const resolvedClinicAddress = fmt(textOrNull(medical.clinicAddress) ?? textOrNull((eyeglass as any).clinicAddress))
  const resolvedConsultationDate = formatLongDate(
    textOrNull(medical.consultationDate) ?? textOrNull(caseData.dateOfAssessment)
  )
  const resolvedMedicalBill = fmt(textOrNull(medical.typeOfBill))
  const resolvedFindings = fmt(
    textOrNull(caseData.assessment)
    ?? textOrNull(caseData.backgroundOfProblem)
  )
  const resolvedNatureOfAssistance = fmt(textOrNull((caseData.plainDetails as any)?.natureOfAssistance))
  const resolvedMedicalRequestedAssistance = fmt(
    textOrNull(medical.medicalType)
    ?? textOrNull(medical.operationType)
    ?? textOrNull((caseData as any).portalApplicationContext?.medicalRequestedAssistance)
    ?? textOrNull((caseData as any).portalApplicationContext?.medicalType)
    ?? textOrNull((caseData as any).portalApplicationContext?.operationType)
  )

  const clientName = `${c.lastName}, ${[c.firstName, c.middleName].filter(Boolean).join(' ')}`
  const fullName   = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')
  const resolvedPatientName = fmt(textOrNull(hospital.patientName) ?? textOrNull(fullName))
  const address    = [c.barangay, c.municipality, c.province].filter(Boolean).join(', ') || '-'
  const resolvedDeceasedAddress = fmt(textOrNull((burial as any).deceasedAddress) ?? textOrNull(address))
  const resolvedAddress = caseData.assistanceType === 'burial' ? resolvedDeceasedAddress : address
  const resolvedDeceasedName = fmt(textOrNull((burial as any).deceasedName) ?? textOrNull(fullName))
  const resolvedDeceasedAge = fmt(textOrNull((burial as any).deceasedAge) ?? calcAge(c.dateOfBirth))
  const resolvedDeceasedOccupation = fmt(textOrNull((burial as any).deceasedOccupation) ?? textOrNull(c.occupation))
  const resolvedDeceasedCivilStatus = fmt(textOrNull((burial as any).deceasedCivilStatus) ?? textOrNull(c.civilStatus))
  const resolvedDeceasedSex = fmt(textOrNull((burial as any).deceasedSex) ?? textOrNull(c.sex))
  const resolvedBeneficiaryName = caseData.assistanceType === 'burial' ? resolvedDeceasedName : fmt(fullName)
  const resolvedBeneficiaryNameList = caseData.assistanceType === 'burial'
    ? resolvedDeceasedName
    : fmt(clientName)
  const resolvedBeneficiaryAddress = caseData.assistanceType === 'burial' ? resolvedDeceasedAddress : fmt(address)
  const resolvedProxyName = fmt(fullName)
  const resolvedProxyNameList = fmt(clientName)
  const burialConformeName = textOrNull(burial.conformeName)
  const burialConformeRelationship = textOrNull(burial.conformeRelationship)
  const hospitalConformeName = textOrNull(hospital.conformeName)
  const hospitalConformeRelationship = textOrNull(hospital.conformeRelationship)
  const medicalConformeName = textOrNull(medical.conformeName)
  const medicalConformeRelationship = textOrNull(medical.conformeRelationship)
  const eyeglassConformeName = textOrNull((eyeglass as any).conformeName)
  const eyeglassConformeRelationship = textOrNull((eyeglass as any).conformeRelationship)
  const resolvedBurialRequestorName = caseData.assistanceType === 'burial' ? fmt(burialConformeName ?? textOrNull(fullName)) : resolvedProxyName
  const resolvedBurialRequestorNameList = caseData.assistanceType === 'burial' ? resolvedBurialRequestorName : resolvedProxyNameList
  const medicineConformeName = textOrNull((medicine as any).conformeName)
  const medicineConformeRelationship = textOrNull((medicine as any).conformeRelationship)
  const hasMedicineRequestingParty = caseData.assistanceType === 'medicine' && Boolean(medicineConformeName)
  const shouldBlankRequestor =
    (caseData.assistanceType === 'medicine' && !medicineConformeName && !medicineConformeRelationship)
    || (caseData.assistanceType === 'hospital' && !hospitalConformeName && !hospitalConformeRelationship)
    || (caseData.assistanceType === 'medical' && !medicalConformeName && !medicalConformeRelationship)
    || (caseData.assistanceType === 'burial' && !burialConformeName && !burialConformeRelationship)
    || (caseData.assistanceType === 'eyeglass' && !eyeglassConformeName && !eyeglassConformeRelationship)
  const allowSelfRelationship =
    !((caseData.assistanceType === 'hospital' && hospital.templateType === 'proxy')
      || (caseData.assistanceType === 'medicine' && (medicineTemplateType === 'proxy' || hasMedicineRequestingParty))
      || (caseData.assistanceType === 'medical' && medicalTemplateType === 'proxy')
      || (caseData.assistanceType === 'eyeglass' && eyeglassTemplateType === 'proxy'))
  const resolvedConformeName = fmt(
    eyeglassConformeName
    ?? medicineConformeName
    ?? hospitalConformeName
    ?? medicalConformeName
    ?? burialConformeName
    ?? textOrNull(hospital.patientName)
    ?? textOrNull(fullName)
  )
  const resolvedRelationship = fmt(
    eyeglassConformeRelationship
    ?? medicineConformeRelationship
    ?? hospitalConformeRelationship
    ?? medicalConformeRelationship
    ?? burialConformeRelationship
    ?? (hasMedicineRequestingParty ? 'N/A' : allowSelfRelationship ? 'Self' : null)
  )
  const resolvedDateOfAssessment = formatLongDate(
    textOrNull(caseData.dateOfAssessment)
    ?? textOrNull(hospital.admissionDate)
    ?? textOrNull(medical.consultationDate)
    ?? textOrNull((caseData as any).applicantApplication?.submittedAt)
    ?? textOrNull((caseData as any).createdAt)
  )
  const resolvedDateOfDeath = formatLongDate(
    textOrNull(burial.dateOfDeath)
    ?? textOrNull((caseData as any).portalApplicationContext?.intermentDate)
  )
  const resolvedIntermentDate = formatLongDate(
    textOrNull((caseData as any).portalApplicationContext?.intermentDate)
  )
  const resolvedCauseOfDeath = fmt(textOrNull((burial as any).causeOfDeath))
  const resolvedTypeOfBill = fmt(
    textOrNull((burial as any).typeOfBill)
    ?? textOrNull(hospital.typeOfBill)
    ?? (caseData.assistanceType === 'burial' ? 'funeral bill' : null)
  )
  const resolvedMedType = fmt(textOrNull(caseData.presentingProblem) ?? 'purchase medicine')
  const resolvedSufferingType = fmt(
    textOrNull(caseData.backgroundOfProblem)
    ?? textOrNull(caseData.assessment)
    ?? textOrNull(hospital.diagnosis)
  )

  const familyComposition = (caseData.familyComposition ?? []).map((m: any) => ({
    name:         fmt(m.name),
    relationship: fmt(m.relationship),
    age:          m.age != null ? String(m.age) : '-',
    FmAge:        m.age != null ? String(m.age) : '-',
    occupation:   fmt(m.occupation),
    FmOccupation: fmt(m.occupation),
    income:       m.monthlyIncome != null ? String(m.monthlyIncome) : fmt(m.income),
  }))
  const checked = '\u2611'
  const unchecked = '\u2610'
  const checkbox = (value: boolean) => (value ? checked : unchecked)
  const isAssistanceType = (type: string) => caseData.assistanceType === type
  const clientCategory = String(c.clientCategory ?? '').trim().toLowerCase()
  const hasCategory = (needle: string) => clientCategory.includes(needle)
  const isIntakeSourceCategory = ['walk-in', 'walk_in', 'referred', 'rescued'].includes(clientCategory)
  const isKnownBeneficiaryCategory = hasCategory('4ps') || hasCategory('solo') || hasCategory('senior') || hasCategory('pwd')
  const hasOtherBeneficiaryCategory = Boolean(clientCategory) && !isIntakeSourceCategory && !isKnownBeneficiaryCategory
  const rawRequirements = caseData.requirements ?? []
  const requirementMap = new Map<string, boolean>()
  if (Array.isArray(rawRequirements)) {
    for (const row of rawRequirements) {
      requirementMap.set(String(row.requirementName ?? row.key ?? ''), Boolean(row.isSubmitted ?? row.submitted ?? false))
    }
  } else if (typeof rawRequirements === 'object') {
    for (const [key, value] of Object.entries(rawRequirements)) {
      requirementMap.set(key, Boolean(value))
    }
  }
  const isReqSubmitted = (...keys: string[]) => keys.some((key) => requirementMap.get(key) === true)
  const isMedicine = isAssistanceType('medicine')
  const isMedical = isAssistanceType('medical')
  const isBurial = isAssistanceType('burial')
  const isHospital = isAssistanceType('hospital')
  const isSubsequentAvailment = Boolean((caseData as any).isSubsequentAvailment)
  const resolvedRequestingParty = shouldBlankRequestor ? '' : resolvedConformeName
  const resolvedRelationshipToBeneficiary = shouldBlankRequestor ? '' : resolvedRelationship
  const isSelfRequest = ['self', '-', ''].includes(String(resolvedRelationshipToBeneficiary).trim().toLowerCase())
  const resolvedRequestingPartyPhrase = shouldBlankRequestor
    ? 'The beneficiary'
    : isSelfRequest
      ? resolvedBeneficiaryName
      : `${resolvedRequestingParty}, the ${resolvedRelationshipToBeneficiary} of the beneficiary,`
  const resolvedServiceProviderName = fmt(
    caseData.assistanceType === 'burial' ? textOrNull(burial.funeralHome)
    : caseData.assistanceType === 'hospital' ? textOrNull(hospital.hospitalName)
    : caseData.assistanceType === 'medical' ? textOrNull(medical.clinicName)
    : caseData.assistanceType === 'eyeglass' ? textOrNull((eyeglass as any).clinicName)
    : textOrNull((caseData as any).serviceProviderName)
  )
  const assistancePurposeByType: Record<string, string> = {
    hospital: 'payment of hospitalization expenses',
    medical: resolvedMedicalRequestedAssistance !== '-' ? resolvedMedicalRequestedAssistance : 'medical procedure/examination',
    eyeglass: 'purchase of eyeglasses',
    medicine: 'purchase of medicines',
    burial: 'burial/funeral expenses',
    plain: resolvedNatureOfAssistance !== '-' ? resolvedNatureOfAssistance : 'emergency assistance',
  }
  const resolvedAssistancePurpose = assistancePurposeByType[caseData.assistanceType] ?? 'emergency assistance'
  const resolvedSpecificNeed = fmt(
    caseData.assistanceType === 'hospital' && resolvedHospitalName !== '-'
      ? `${resolvedAssistancePurpose} at ${resolvedHospitalName}`
    : caseData.assistanceType === 'medical' && resolvedClinicName !== '-'
      ? `${resolvedAssistancePurpose} at ${resolvedClinicName}`
    : caseData.assistanceType === 'burial' && fmt(burial.funeralHome) !== '-'
      ? `${resolvedAssistancePurpose} at ${fmt(burial.funeralHome)}`
    : resolvedAssistancePurpose
  )
  const resolvedImmediateCircumstance = fmt(
    textOrNull(caseData.presentingProblem)
    ?? (resolvedDiagnosis !== '-' ? resolvedDiagnosis : null)
    ?? (resolvedFindings !== '-' ? resolvedFindings : null)
  )
  const resolvedIncomeSituation = fmt(textOrNull((caseData as any).incomeSituation) ?? 'limited and irregular income')
  const resolvedCaseSpecificFindings = resolvedFindings
  const resolvedEvaluationRecommendation = caseData.assistanceType === 'medicine'
    ? `In view of the above, the undersigned recommends that the beneficiary avail of financial assistance from the City Government through the Assistance to Individuals in Crisis Situation (AICS) Program, for ${resolvedAssistancePurpose}, in the amount of ${amountToWords(Number(amount))} (P${Number(amount).toFixed(2)}).`
    : `In view of the above, the undersigned recommends that the beneficiary avail of financial assistance from the City Government through the Assistance to Individuals in Crisis Situation (AICS) Program, through a Guarantee Letter addressed to ${resolvedServiceProviderName}, for ${resolvedAssistancePurpose}, in the amount of ${amountToWords(Number(amount))} (P${Number(amount).toFixed(2)}).`
  const reviewedByName = fmt(textOrNull((caseData as any).reviewedByName))
  const reviewedByTitle = fmt(textOrNull((caseData as any).reviewedByTitle) ?? 'Social Welfare Officer II')
  const reviewedByDate = formatLongDate((caseData as any).reviewedByDate)
  const reviewedBySignature = textOrNull((caseData as any).reviewedBySignature)

  const recommendingByName = fmt(textOrNull((caseData as any).recommendingByName))
  const recommendingByTitle = fmt(textOrNull((caseData as any).recommendingByTitle) ?? "City Social Welfare and Dev't. Officer")
  const recommendingByDate = formatLongDate((caseData as any).recommendingByDate)
  const recommendingBySignature = textOrNull((caseData as any).recommendingBySignature)

  const approvedByName = fmt(textOrNull((caseData as any).approvedByName))
  const approvedByTitle = fmt(textOrNull((caseData as any).approvedByTitle) ?? 'City Mayor')
  const approvedByDate = formatLongDate((caseData as any).approvedByDate)
  const approvedBySignature = textOrNull((caseData as any).approvedBySignature)

  // Build per-user signature entries (e.g. { maribelleArtienda: '<url>' })
  // Always include the key even when no URL so templates don't render "undefined" for missing keys.
  const userSignatureParams: Record<string, string | null> = {}
  const allSignatureParamKeys: string[] = []
  for (const stage of ['for_review', 'recommending_approval', 'for_approval'] as const) {
    const approval = (caseData as any).approvals?.[stage]
    const signatureParam = approval?.signatureParam ?? null
    const signatureUrl = approval?.signatureUrl ?? null
    if (signatureParam) {
      userSignatureParams[signatureParam] = signatureUrl
      allSignatureParamKeys.push(signatureParam)
    }
  }
  // Preparer (social worker) signature and position - always available from their profile
  const preparedByPosition  = fmt(textOrNull((caseData as any).preparedByPosition) ?? textOrNull((caseData as any).socialWorkerPosition))
  const preparedBySignature = textOrNull((caseData as any).preparedBySignature)
  const preparedBySignatureParam = textOrNull((caseData as any).preparedBySignatureParam)
  if (preparedBySignatureParam) {
    userSignatureParams[preparedBySignatureParam] = preparedBySignature
    allSignatureParamKeys.push(preparedBySignatureParam)
  }

  return {
    // User-specific signature placeholders (e.g. {maribelleArtienda})
    ...userSignatureParams,
    // Internal marker so renderDoc knows which dynamic keys are signature image tags.
    __sigParamKeys: allSignatureParamKeys,

    // Header
    dateOfAssessment:    resolvedDateOfAssessment,
    caseNumber:          fmt(caseData.caseNumber),

    // Global CGV AICS template checkboxes and labels
    hospitalCheckBox:    checkbox(isAssistanceType('hospital')),
    medicalCheckBox:     checkbox(isAssistanceType('medical')),
    eyeglassCheckBox:    checkbox(isAssistanceType('eyeglass')),
    medicineCheckBox:    checkbox(isAssistanceType('medicine')),
    burialCheckBox:      checkbox(isAssistanceType('burial')),
    otherAssistanceCheckBox: checkbox(isAssistanceType('plain')),
    otherAssistanceText: isAssistanceType('plain') ? resolvedNatureOfAssistance : '',
    fourPsCheckBox:      checkbox(Boolean(c.is4ps) || hasCategory('4ps')),
    soloParentCheckBox:  checkbox(hasCategory('solo')),
    seniorCitizenCheckBox: checkbox(Boolean(c.isSenior) || hasCategory('senior')),
    pwdCheckBox:         checkbox(Boolean(c.isPwd) || hasCategory('pwd')),
    otherCategoryCheckBox: checkbox(hasOtherBeneficiaryCategory),
    otherCategoryText:   hasOtherBeneficiaryCategory ? fmt(c.clientCategory) : '',

    // Global CGV AICS Documentary Requirements Submitted table ticks
    medicineDocsCheckBox: checkbox(isMedicine),
    medicalDocsCheckBox:  checkbox(isMedical),
    burialDocsCheckBox:   checkbox(isBurial),
    hospitalDocsCheckBox: checkbox(isHospital),
    reqMedicineLetterRequest: checkbox(isMedicine && isReqSubmitted('personal_letter')),
    reqMedicalRequestForm: checkbox(isMedical && isReqSubmitted('med_request')),
    reqhospitalClinicalAbstract: checkbox(isHospital && isReqSubmitted('clinical_abstract')),
    reqHospitalClinicalAbstract: checkbox(isHospital && isReqSubmitted('clinical_abstract')),
    reqBurialClinicalAbstract: checkbox(isHospital && isReqSubmitted('clinical_abstract')),
    reqBurialDeathCertificate: checkbox(isBurial && isReqSubmitted('death_cert')),
    reqHospitalDeathCertificate: checkbox(isBurial && isReqSubmitted('death_cert')),
    reqMedicineMedicalCertificate: checkbox(isMedicine && isReqSubmitted('medical_cert')),
    reqMedicalMedicalCertificate: checkbox(isMedical && isReqSubmitted('medical_cert')),
    reqHospitalFinalBill: checkbox(isHospital && isReqSubmitted('final_bill')),
    reqBurialFinalBill: checkbox(isHospital && isReqSubmitted('final_bill')),
    reqBurialBillingStatement: checkbox(isBurial && isReqSubmitted('billing_stmt', 'hospital_bill')),
    reqHospitalBillingStatement: checkbox(isBurial && isReqSubmitted('billing_stmt', 'hospital_bill')),
    reqMedicinePrescription: checkbox(isMedicine && isReqSubmitted('prescription')),
    reqMedicineEyeglassCertificate: checkbox(isAssistanceType('eyeglass') && isReqSubmitted('prescription')),
    reqMedicalPriceQuotation: checkbox(isMedical && isReqSubmitted('price_quotation')),
    reqHospitalPromissoryNote: checkbox(isHospital && isReqSubmitted('promissory_note')),
    reqBurialPromissoryNote: checkbox(isHospital && isReqSubmitted('promissory_note')),
    reqHospitalCertificateIndigency: checkbox(isHospital && isReqSubmitted('indigency')),
    reqMedicineCertificateIndigency: checkbox(isMedicine && isReqSubmitted('indigency')),
    reqMedicalCertificateIndigency: checkbox(isMedical && isReqSubmitted('indigency')),
    reqEyeglassCertificateIndigency: checkbox(isAssistanceType('eyeglass') && isReqSubmitted('indigency')),
    reqBurialCertificateIndigency: checkbox(isBurial && isReqSubmitted('indigency')),
    reqHospitalPhotocopyId: checkbox(isHospital && isReqSubmitted('id_copy')),
    reqMedicinePhotocopyId: checkbox(isMedicine && isReqSubmitted('id_copy')),
    reqMedicalPhotocopyId: checkbox(isMedical && isReqSubmitted('id_copy')),
    reqEyeglassPhotocopyId: checkbox(isAssistanceType('eyeglass') && isReqSubmitted('id_copy')),
    reqBurialPhotocopyId: checkbox(isBurial && isReqSubmitted('id_copy')),
    reqMedicineCertificateNoAvailableMedicine: checkbox(isMedicine && isReqSubmitted('cho_cert')),

    // Backward-compatible aliases for older templates.
    reqLetterRequest:     checkbox(isAssistanceType('medicine') && isReqSubmitted('personal_letter')),
    reqRequestForm:       checkbox(isAssistanceType('medical') && isReqSubmitted('med_request')),
    reqClinicalAbstract:  checkbox(isAssistanceType('hospital') && isReqSubmitted('clinical_abstract')),
    reqDeathCertificate:  checkbox(isAssistanceType('burial') && isReqSubmitted('death_cert')),
    reqMedicalCertificate: checkbox(isAssistanceType('medicine') && isReqSubmitted('medical_cert')),
    reqMedicalCertificateMedical: checkbox(isAssistanceType('medical') && isReqSubmitted('medical_cert')),
    reqFinalBill:         checkbox(isAssistanceType('hospital') && isReqSubmitted('final_bill')),
    reqBillingStatement:  checkbox(isAssistanceType('burial') && isReqSubmitted('billing_stmt', 'hospital_bill')),
    reqPrescription:      checkbox(isAssistanceType('medicine') && isReqSubmitted('prescription')),
    reqPriceQuotation:    checkbox(isAssistanceType('medical') && isReqSubmitted('price_quotation')),
    reqPromissoryNote:    checkbox(isAssistanceType('hospital') && isReqSubmitted('promissory_note')),
    reqCertificateIndigency: checkbox(isAssistanceType('medicine') && isReqSubmitted('indigency')),
    reqCertificateIndigencyMedical: checkbox(isAssistanceType('medical') && isReqSubmitted('indigency')),
    reqCertificateIndigencyBurial: checkbox(isAssistanceType('hospital') && isReqSubmitted('indigency')),
    reqPhotocopyId:       checkbox(isAssistanceType('medicine') && isReqSubmitted('id_copy')),
    reqPhotocopyIdMedical: checkbox(isAssistanceType('medical') && isReqSubmitted('id_copy')),
    reqPhotocopyIdBurial: checkbox(isAssistanceType('hospital') && isReqSubmitted('id_copy')),
    reqPhotocopyIdHospital: checkbox(isAssistanceType('burial') && isReqSubmitted('id_copy')),
    reqCertificateNoAvailableMedicine: checkbox(isAssistanceType('medicine') && isReqSubmitted('cho_cert')),

    // Client
    clientName:          resolvedBeneficiaryNameList,
    fullName:            resolvedBeneficiaryName,
    beneficiaryName:     resolvedBeneficiaryName,
    beneficiaryAddress:  resolvedBeneficiaryAddress,
    proxyName:           resolvedRequestingParty,
    proxyClientName:     resolvedRequestingParty,
    proxyRelationship:   resolvedRelationshipToBeneficiary,
    requestorName:       resolvedRequestingParty,
    requestorClientName: resolvedRequestingParty,
    address:             resolvedAddress,
    age:                 caseData.assistanceType === 'burial' ? resolvedDeceasedAge : calcAge(c.dateOfBirth),
    dateOfBirth:         caseData.assistanceType === 'burial' ? '-' : fmt(c.dateOfBirth),
    occupation:          caseData.assistanceType === 'burial' ? resolvedDeceasedOccupation : fmt(c.occupation),
    religion:            fmt((c as any).religion),
    civilStatus:         caseData.assistanceType === 'burial' ? resolvedDeceasedCivilStatus : fmt(c.civilStatus),
    sex:                 caseData.assistanceType === 'burial' ? resolvedDeceasedSex : fmt(c.sex),
    contactNumber:       fmt(c.contactNumber),
    requestingParty:     resolvedRequestingParty,
    relationshipToBeneficiary: resolvedRelationshipToBeneficiary,
    requestingPartyPhrase: resolvedRequestingPartyPhrase,
    clientCategory:      fmt(c.clientCategory),
    is4ps:               c.is4ps    ? 'Yes' : 'No',
    isPwd:               c.isPwd    ? 'Yes' : 'No',
    isSenior:            c.isSenior ? 'Yes' : 'No',

    // Family composition loop
    familyComposition,

    // Narratives
    presentingProblem:   fmt(caseData.presentingProblem),
    backgroundOfProblem: fmt(caseData.backgroundOfProblem),
    assessment:          fmt(caseData.assessment),
    findings:            resolvedFindings,
    problemPresented:    fmt(textOrNull(caseData.presentingProblem) ?? resolvedImmediateCircumstance),
    specificNeed:        resolvedSpecificNeed,
    immediateCircumstance: resolvedImmediateCircumstance,
    incomeSituation:     resolvedIncomeSituation,
    caseSpecificFindings: resolvedCaseSpecificFindings,
    natureOfAssistance:  resolvedNatureOfAssistance,
    recommendation:      fmt(caseData.recommendation),
    evaluationRecommendation: resolvedEvaluationRecommendation,
    remarks:             fmt(caseData.remarks),
    medType:             resolvedMedType,
    sufferingType:       resolvedSufferingType,

    // Social worker
    socialWorkerName:    fmt(caseData.socialWorkerName),
    Employee:            fmt(caseData.socialWorkerName),
    employee:            fmt(caseData.socialWorkerName),

    // Financials
    amount:              Number(amount).toFixed(2),
    amountInWords:       amountToWords(Number(amount)),
    amountText:          Number(amount).toFixed(2),
    cashAmount:          Number(amount).toFixed(2),
    amountWords:         amountToWords(Number(amount)),
    cash:                `${amountToWords(Number(amount))} (P${Number(amount).toFixed(2)})`,
    serviceProviderName: resolvedServiceProviderName,
    NameofServiceProvider: resolvedServiceProviderName,
    NameOfServiceProvider: resolvedServiceProviderName,
    providerName:        resolvedServiceProviderName,
    recipientName:       resolvedServiceProviderName,
    serviceProviderAddress: fmt(
      caseData.assistanceType === 'burial' ? textOrNull(burial.funeralOwnerAddress)
      : caseData.assistanceType === 'hospital' ? textOrNull(hospital.hospitalAddress)
      : caseData.assistanceType === 'medical' ? textOrNull(medical.clinicAddress)
      : caseData.assistanceType === 'eyeglass' ? textOrNull((eyeglass as any).clinicAddress)
      : textOrNull((caseData as any).serviceProviderAddress)
    ),
    assistancePurpose:   resolvedAssistancePurpose,
    requestedAssistance: resolvedAssistancePurpose,
    typeOfAssistance:    resolvedAssistancePurpose,
    firstAvailmentCheckBox: checkbox(!isSubsequentAvailment),
    subsequentAvailmentCheckBox: checkbox(isSubsequentAvailment),

    // Burial fields
    deceasedName:        resolvedDeceasedName,
    deceasedAddress:     resolvedDeceasedAddress,
    deceasedAge:         resolvedDeceasedAge,
    deceasedOccupation:  resolvedDeceasedOccupation,
    deceasedCivilStatus: resolvedDeceasedCivilStatus,
    dateOfDeath:         resolvedDateOfDeath,
    dateDied:            resolvedDateOfDeath,
    causeOfDeath:        resolvedCauseOfDeath,
    funeralHome:         fmt(burial.funeralHome),
    funeralHomeName:     fmt(burial.funeralHome),
    funeralhomeOwner:    fmt(burial.funeralHomeOwner),
    funeralOwner:        fmt(burial.funeralHomeOwner),
    funeralownerAddress: fmt(burial.funeralOwnerAddress),
    funeralHomeAddress:  fmt(burial.funeralOwnerAddress),
    funeralHomeOwner:    fmt(burial.funeralHomeOwner),
    funeralOwnerAddress: fmt(burial.funeralOwnerAddress),
    typeOfBill:          resolvedTypeOfBill,
    intermentDate:       resolvedIntermentDate,
    dateOfInterment:     resolvedIntermentDate,
    interredDate:        resolvedIntermentDate,
    intermitentPlace:    fmt(burial.intermentPlace),
    intermentPlace:      fmt(burial.intermentPlace),
    ConformeName:        resolvedConformeName,
    relationship:        resolvedRelationshipToBeneficiary,
    Relationship:        resolvedRelationship,
    glDate:              new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    dateToday:           new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    date:                resolvedDateOfAssessment,

    // Hospital fields
    patientName:         resolvedPatientName,
    PatientName:         resolvedPatientName,
    hospitalName:        resolvedHospitalName,
    hospital:            resolvedHospitalName,
    hospitalAddress:     resolvedHospitalAddress,
    doctorName:          resolvedDoctorName,
    physicianName:       resolvedDoctorName,
    attendingPhysician:  resolvedDoctorName,
    mdPosition:          resolvedMdPosition,
    doctorPosition:      resolvedMdPosition,
    admissionDate:       resolvedAdmissionDate,
    dateAdmitted:        resolvedAdmissionDate,
    diagnosis:           resolvedDiagnosis,
    diagnoseType:        resolvedDiagnosis,
    hospitalizationType: resolvedHospitalizationType,
    hospitallBill:       resolvedHospitalBill,
    hospitalBill:        resolvedHospitalBill,
    billingStatement:    resolvedHospitalBill,

    // Eyeglass fields
    optiFullnameDoctor:  fmt(textOrNull((eyeglass as any).doctorName)),
    lastnameDoctor:      fmt(textOrNull((eyeglass as any).doctorName)?.split(' ').pop()),
    releasedDay:         String(new Date().getDate()),
    releasedMonth:       new Date().toLocaleString('en-PH', { month: 'long' }),

    // Medical / Eyeglass shared clinic fields
    clinicName:          resolvedClinicName,
    clinic:              resolvedClinicName,
    clinicAddress:       resolvedClinicAddress,
    consultationDate:    resolvedConsultationDate,
    medicalBill:         resolvedMedicalBill,
    medicalType:         resolvedMedicalRequestedAssistance,
    medicalProcedure:    resolvedMedicalRequestedAssistance,
    procedureType:       resolvedMedicalRequestedAssistance,
    diagnosedType:       fmt(textOrNull(medical.diagnosedType)),
    operationType:       resolvedMedicalRequestedAssistance,

    templateType:        fmt(
      caseData.assistanceType === 'medicine' ? medicineTemplateType
      : caseData.assistanceType === 'medical' ? medicalTemplateType
      : caseData.assistanceType === 'eyeglass' ? eyeglassTemplateType
      : hospital.templateType
    ),
    isProxy: (
      caseData.assistanceType === 'medicine' ? medicineTemplateType === 'proxy'
      : caseData.assistanceType === 'medical' ? medicalTemplateType === 'proxy'
      : caseData.assistanceType === 'eyeglass' ? eyeglassTemplateType === 'proxy'
      : hospital.templateType === 'proxy'
    ) ? 'Yes' : 'No',
    isPersonal: (
      caseData.assistanceType === 'medicine' ? medicineTemplateType !== 'proxy'
      : caseData.assistanceType === 'medical' ? medicalTemplateType !== 'proxy'
      : caseData.assistanceType === 'eyeglass' ? eyeglassTemplateType !== 'proxy'
      : hospital.templateType !== 'proxy'
    ) ? 'Yes' : 'No',
    conformeName:        resolvedConformeName,
    conformeRelationship: resolvedRelationshipToBeneficiary,
    heShe:               activePronouns.heShe,
    hisHer:              activePronouns.hisHer,
    himHer:              activePronouns.himHer,
    they:                activePronouns.heShe,
    their:               activePronouns.hisHer,
    them:                activePronouns.himHer,
    HeShe:               activePronouns.heShe.charAt(0).toUpperCase() + activePronouns.heShe.slice(1),
    HisHer:              activePronouns.hisHer.charAt(0).toUpperCase() + activePronouns.hisHer.slice(1),
    HimHer:              activePronouns.himHer.charAt(0).toUpperCase() + activePronouns.himHer.slice(1),
    They:                activePronouns.heShe.charAt(0).toUpperCase() + activePronouns.heShe.slice(1),
    Their:               activePronouns.hisHer.charAt(0).toUpperCase() + activePronouns.hisHer.slice(1),
    Them:                activePronouns.himHer.charAt(0).toUpperCase() + activePronouns.himHer.slice(1),

    // Prepared by (social worker / case study maker)
    position:            preparedByPosition,
    Position:            preparedByPosition,
    employeePosition:    preparedByPosition,
    casestudyMaker:      preparedBySignature,
    preparedBySignature,

    // Approval hierarchy fields
    reviewedByName,
    reviewedBy:          reviewedByName,
    Administrator:       fmt(textOrNull((caseData as any).officialAdministratorName) ?? reviewedByName),
    administrator:       fmt(textOrNull((caseData as any).officialAdministratorName) ?? reviewedByName),
    cityAdministrator:   fmt(textOrNull((caseData as any).officialAdministratorName) ?? reviewedByName),
    CityAdministrator:   fmt(textOrNull((caseData as any).officialAdministratorName) ?? reviewedByName),
    reviewedByTitle,
    reviewedByPosition:  reviewedByTitle,
    reviewedByDate,
    reviewedBySignature,

    recommendingByName,
    recommendingBy:        recommendingByName,
    CSWDO:                 fmt(textOrNull((caseData as any).officialCswdoName) ?? recommendingByName),
    cswdo:                 fmt(textOrNull((caseData as any).officialCswdoName) ?? recommendingByName),
    cityCSWDO:             fmt(textOrNull((caseData as any).officialCswdoName) ?? recommendingByName),
    CityCSWDO:             fmt(textOrNull((caseData as any).officialCswdoName) ?? recommendingByName),
    recommendingByTitle,
    recommendingByPosition: recommendingByTitle,
    recommendingByDate,
    recommendingBySignature,

    approvedByName,
    approvedBy:          approvedByName,
    cityMayor:           fmt(textOrNull((caseData as any).officialCityMayorName) ?? approvedByName),
    CityMayor:           fmt(textOrNull((caseData as any).officialCityMayorName) ?? approvedByName),
    mayor:               fmt(textOrNull((caseData as any).officialCityMayorName) ?? approvedByName),
    approvedByTitle,
    approvedByPosition:  approvedByTitle,
    approvedByDate,
    approvedBySignature,

    // Verifiable document fields for guarantee-letter templates
    documentQrCode:      textOrNull((caseData as any).documentQrCode),
    documentVerificationUrl: fmt(textOrNull((caseData as any).documentVerificationUrl)),
    documentVerificationCode: fmt(textOrNull((caseData as any).documentVerificationCode)),
  }
}

function isDelimiterError(error: unknown): boolean {
  const ids = new Set<string>()
  const e = error as { properties?: { id?: string; errors?: Array<{ properties?: { id?: string } }> } }
  if (e?.properties?.id) ids.add(e.properties.id)
  for (const nested of e?.properties?.errors ?? []) {
    if (nested?.properties?.id) ids.add(nested.properties.id)
  }
  return ids.has('unopened_tag') || ids.has('unclosed_tag')
}

function renderDocWithDelimiters(
  templateContent: string,
  data: Record<string, any>,
  delimiters?: { start: string; end: string }
): Buffer {
  const zip = new PizZip(templateContent)
  const imageModule = new (ImageModule as any)({
    centered: false,
    fileType: 'docx',
    getImage: (tagValue: unknown) => readSignatureImage(tagValue),
    getSize: (_img: unknown, _tagValue: unknown, tagName?: string) => {
      if (tagName === 'documentQrCode') return [120, 120]
      return [160, 58]
    },
  })

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
    ...(delimiters ? { delimiters } : {}),
  })
  ;(doc as any).hideDeprecations = true
  doc.render(data)
  ;(doc as any).hideDeprecations = false
  const generated = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
  return sanitizeGeneratedDocxBuffer(generated)
}

// docxtemplater-image-module-free requires {%tagName} for image tags.
// Word templates often store {, tagName, and } in separate XML runs (with proofErr in between).
// This function strips proofErr, then rewrites the opening { run to {% for known image tags.
const SIGNATURE_IMAGE_TAGS = [
  'casestudyMaker',
  'preparedBySignature',
  'reviewedBySignature',
  'recommendingBySignature',
  'approvedBySignature',
  'documentQrCode',
]

function addMissingXmlNamespaces(xml: string): string {
  const namespaceDeclarations: Array<[RegExp, string, string]> = [
    [/<wp:/, 'xmlns:wp', 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'],
    [/<a:/, 'xmlns:a', 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'],
    [/<pic:/, 'xmlns:pic', 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'],
    [/\sr:embed=/, 'xmlns:r', 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'],
  ]

  return xml.replace(/<([A-Za-z0-9_.:-]+)([^>]*)>/, (rootTag, name, attrs) => {
    const missingDeclarations = namespaceDeclarations
      .filter(([usesPrefix, namespaceName]) => usesPrefix.test(xml) && !rootTag.includes(namespaceName))
      .map(([, , declaration]) => declaration)

    if (missingDeclarations.length === 0) return rootTag
    return `<${name}${attrs} ${missingDeclarations.join(' ')}>`
  })
}
function sanitizeGeneratedDocxBuffer(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer)
  let changed = false

  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith('.xml')) continue
    const entry = zip.file(filename)
    if (!entry) continue

    const original = entry.asText()
    const cleaned = addMissingXmlNamespaces(original)
    if (cleaned !== original) {
      zip.file(filename, cleaned)
      changed = true
    }
  }

  if (!changed) return buffer
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

function rewriteParagraphText(xml: string, transform: (text: string) => string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'))
  let changed = false

  for (const paragraph of paragraphs) {
    const texts = Array.from(paragraph.getElementsByTagName('w:t'))
    if (texts.length === 0) continue

    const original = texts.map((node) => node.textContent ?? '').join('')
    const updated = transform(original)
    if (updated === original) continue

    texts[0].textContent = updated
    for (const node of texts.slice(1)) {
      node.textContent = ''
    }
    changed = true
  }

  if (!changed) return xml

  const serialized = new XMLSerializer().serializeToString(doc)
  const xmlDeclMatch = xml.match(/^\s*<\?xml[\s\S]*?\?>/)
  return xmlDeclMatch
    ? `${xmlDeclMatch[0]}${serialized.replace(/^\s*<\?xml[\s\S]*?\?>\s*/, '')}`
    : serialized
}

function removeMedicineGuaranteeLetterClause(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer)
  let changed = false
  const clausePattern = /,\s*through a Guarantee Letter addressed to\s+.*?,\s*for\s+/i

  for (const filename of Object.keys(zip.files)) {
    if (!filename.startsWith('word/') || !filename.endsWith('.xml')) continue
    const entry = zip.file(filename)
    if (!entry) continue

    const original = entry.asText()
    const updated = rewriteParagraphText(original, (text) => {
      if (!text.includes('through a Guarantee Letter addressed to')) return text
      return text
        .replace(clausePattern, ', for ')
        .replace(/\s{2,}/g, ' ')
        .trim()
    })

    if (updated !== original) {
      zip.file(filename, updated)
      changed = true
    }
  }

  if (!changed) return buffer
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

function sanitizeTemplateContent(templateContent: string, extraImageTags: string[] = []): string {
  const zip = new PizZip(templateContent)
  let changed = false
  const imageTags = [...SIGNATURE_IMAGE_TAGS, ...extraImageTags]

  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith('.xml')) continue
    const entry = zip.file(filename)
    if (!entry) continue
    const original = entry.asText()

    // 1. Strip Word spell-check markers that split template tags across runs.
    let cleaned = addMissingXmlNamespaces(original.replace(/<w:proofErr[^>]*\/>/g, ''))

    // Keep family-composition table rows compact in generated DOCX output.
    cleaned = cleaned.replace(
      /<w:tr\b(?=[\s\S]*?familyComposition)[\s\S]*?\/familyComposition[\s\S]*?<\/w:tr>/g,
      (row) => row
        .replace(/<w:sz w:val="\d+"\/>/g, '<w:sz w:val="18"/>')
        .replace(/<w:szCs w:val="\d+"\/>/g, '<w:szCs w:val="18"/>')
    )
    // 1b. Normalize space-padded single-run tag names: { clientName } -> {clientName}
    //     Also handles loop tags: {# familyComposition} -> {#familyComposition}
    cleaned = cleaned.replace(
      /(<w:t(?:[\s][^>]*)?>)([^<]*\{[\s#/]*\s+[a-zA-Z][^}<]*\}[^<]*)(<\/w:t>)/g,
      (_match, open, content, close) => {
        const normalized = content
          .replace(/\{\s*#\s+/g, '{#')
          .replace(/\{\s*\/\s+/g, '{/')
          .replace(/\{\s+([a-zA-Z][a-zA-Z0-9_]*)\s+\}/g, '{$1}')
          .replace(/\{\s+([a-zA-Z][a-zA-Z0-9_]*)\}/g, '{$1}')
        return open + normalized + close
      }
    )

    // 1c. Merge split-run template tags, e.g.:
    // 1d. Ensure the narrative paragraph that carries the presenting problem is
    //     regular weight and justified, regardless of template run formatting.
    cleaned = cleaned.replace(
      /<w:p\b[^>]*>[\s\S]*?presentingProblem[\s\S]*?<\/w:p>/g,
      (paragraph) => {
        let normalized = paragraph
          .replace(/<w:b\/>/g, '')
          .replace(/<w:bCs\/>/g, '')

        if (/<w:pPr\b[^>]*>/.test(normalized)) {
          if (!/<w:jc\b[^>]*w:val="both"[^>]*\/>/.test(normalized)) {
            normalized = normalized.replace(/<w:pPr\b([^>]*)>/, '<w:pPr$1><w:jc w:val="both"/>')
          }
        } else {
          normalized = normalized.replace(/<w:p\b([^>]*)>/, '<w:p$1><w:pPr><w:jc w:val="both"/></w:pPr>')
        }

        return normalized
      }
    )

    // 2. Convert text placeholders to image placeholders for signature tags.
    //    After proofErr removal the pattern is: <w:t>{</w:t> ... <w:t>TAGNAME</w:t>
    //    We change the { run to {% so the image module intercepts it.
    const openBrace     = /<w:t>\{<\/w:t>/
    const closeTag      = /<\/w:t>/
    const notAnotherBrace = /(?:(?!<w:t>\{<\/w:t>)[^])*?/
    for (const tag of imageTags) {
      cleaned = cleaned.replace(
        new RegExp(openBrace.source + `(${notAnotherBrace.source}<w:t>)${tag}` + closeTag.source, 'g'),
        `<w:t>{%</w:t>$1${tag}</w:t>`
      )
      cleaned = cleaned.replace(
        new RegExp(`<w:t>\\{${tag}\\}` + closeTag.source, 'g'),
        `<w:t>{%${tag}}</w:t>`
      )
    }

    if (cleaned !== original) {
      zip.file(filename, cleaned)
      changed = true
    }
  }

  if (!changed) return templateContent
  return zip.generate({ type: 'string', compression: 'DEFLATE' }) as string
}

function renderDoc(templateContent: string, data: Record<string, any>, preferred: 'single' | 'double' = 'single'): Buffer {
  // Extract the list of dynamic signature param keys embedded by buildRenderData.
  const knownSigParamKeys: string[] = Array.isArray(data.__sigParamKeys) ? data.__sigParamKeys as string[] : []
  const renderData = { ...data }
  delete renderData.__sigParamKeys

  // Treat all known signature param keys as image tags (even when their URL is null/empty).
  const extraImageTags = [
    ...knownSigParamKeys.filter((k) => !SIGNATURE_IMAGE_TAGS.includes(k)),
    ...Object.keys(renderData).filter(
      (k) => !SIGNATURE_IMAGE_TAGS.includes(k) && !knownSigParamKeys.includes(k) &&
              typeof renderData[k] === 'string' && renderData[k].includes('/uploads/e-signatures/')
    ),
  ]
  const sanitized = sanitizeTemplateContent(templateContent, extraImageTags)
  const preferredDelimiters = preferred === 'double' ? { start: '{{', end: '}}' } : undefined
  const fallbackDelimiters = preferred === 'double' ? undefined : { start: '{{', end: '}}' }

  try {
    return renderDocWithDelimiters(sanitized, renderData, preferredDelimiters)
  } catch (error) {
    if (!isDelimiterError(error)) throw error
    return renderDocWithDelimiters(sanitized, renderData, fallbackDelimiters)
  }
}

export async function generateBurialCaseStudyDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(CASE_STUDY_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateGuaranteeLetterDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(GL_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

// Legacy: combined template (kept for backwards compatibility)
export async function generateBurialDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate([...CASE_STUDY_CANDIDATES, ...GL_CANDIDATES, ...COMBINED_CANDIDATES])
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateHospitalCaseStudyDocx(caseData: any, templateType: 'personal' | 'proxy' = 'personal'): Promise<Buffer> {
  const candidates = templateType === 'proxy' ? HOSPITAL_PROXY_CANDIDATES : HOSPITAL_PERSONAL_CANDIDATES
  const template = loadFirstAvailableTemplate(candidates)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateHospitalGuaranteeLetterDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(HOSPITAL_GL_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateMedicineCaseStudyDocx(
  caseData: any,
  templateType: 'personal' | 'proxy' = 'personal'
): Promise<Buffer> {
  const candidates = templateType === 'proxy'
    ? [...MEDICINE_PROXY_CANDIDATES, ...MEDICINE_PERSONAL_CANDIDATES]
    : MEDICINE_PERSONAL_CANDIDATES
  const template = loadFirstAvailableTemplate(candidates)
  return removeMedicineGuaranteeLetterClause(renderDoc(template, buildRenderData(caseData)))
}

export async function generateMedicineGuaranteeLetterDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(MEDICINE_GL_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateMedicalCaseStudyDocx(
  caseData: any,
  templateType: 'personal' | 'proxy' = 'personal'
): Promise<Buffer> {
  const candidates = templateType === 'proxy'
    ? [...MEDICAL_PROXY_CANDIDATES, ...MEDICAL_PERSONAL_CANDIDATES]
    : MEDICAL_PERSONAL_CANDIDATES
  const template = loadFirstAvailableTemplate(candidates)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateMedicalGuaranteeLetterDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(MEDICAL_GL_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateEyeglassCaseStudyDocx(
  caseData: any,
  templateType: 'personal' | 'proxy' = 'personal'
): Promise<Buffer> {
  const candidates = templateType === 'proxy'
    ? [...EYEGLASS_PROXY_CANDIDATES, ...EYEGLASS_PERSONAL_CANDIDATES]
    : EYEGLASS_PERSONAL_CANDIDATES
  const template = loadFirstAvailableTemplate(candidates)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateEyeglassEndorsementDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(EYEGLASS_ENDORSEMENT_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generateEyeglassAcknowledgementDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(EYEGLASS_ACKNOWLEDGEMENT_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

export async function generatePlainCaseStudyDocx(caseData: any): Promise<Buffer> {
  const template = loadFirstAvailableTemplate(PLAIN_CASE_STUDY_CANDIDATES)
  return renderDoc(template, buildRenderData(caseData))
}

