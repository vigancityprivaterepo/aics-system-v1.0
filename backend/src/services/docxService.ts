import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'
import PDFDocument from 'pdfkit'
import Docxtemplater from 'docxtemplater'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { richTextToPlainText } from '../utils/richText.js'
import {
  resolveAssistancePurpose,
  resolveMedicalRequestedAssistance,
  resolveServiceProviderAddress,
  resolveServiceProviderName,
} from './documentCaseContextService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ImageModule = require('../../vendor/docxtemplater-image-module-safe/index.cjs')
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', 'templates')
const BASE_CASE_STUDY_TEMPLATE = 'CGV AICS Template.fixed.docx'
const CASE_STUDY_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const GL_CANDIDATES = [
  path.join('Burial Case Study and GL', 'Burial Case Study-Guarantee Letter.fixed.docx'),
  'Burial Case Study and GL.fixed.docx',
  'Burial Case Study and GL.docx',
]

const HOSPITAL_PERSONAL_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const HOSPITAL_PROXY_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const HOSPITAL_GL_CANDIDATES = [
  path.join('Hospital Case Study and GL', 'Hospital Case Study-Guarantee Letter.fixed.docx'),
  'Hospital GL.docx',
]

const MEDICINE_PERSONAL_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const MEDICINE_PROXY_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const MEDICINE_GL_CANDIDATES: string[] = [
  path.join('Medicine Case Study', 'Medicine Guarantee Letter.fixed.docx'),
  path.join('Medicine Case Study', 'Medicine GL.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine Guarantee Letter.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine GL.fixed.docx'),
]

const MEDICAL_PERSONAL_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const MEDICAL_PROXY_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const MEDICAL_GL_CANDIDATES = [
  path.join('Medical Case Study and GL', 'Medical GL.fixed.docx'),
  'Medical GL.docx',
]

const EYEGLASS_PERSONAL_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const EYEGLASS_PROXY_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
]

const EYEGLASS_ENDORSEMENT_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'Eyeglass-Endorsement.fixed.docx'),
]

const EYEGLASS_ACKNOWLEDGEMENT_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'eyeglass-acknowledgement.fixed.docx'),
]

const PLAIN_CASE_STUDY_CANDIDATES = [
  BASE_CASE_STUDY_TEMPLATE,
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

function normalizeForCompare(value: unknown): string {
  return richTextToPlainText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
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

function formatOrdinalDay(value: number): string {
  const normalized = Math.abs(Math.trunc(value))
  const mod100 = normalized % 100
  if (mod100 >= 11 && mod100 <= 13) return `${normalized}th`

  switch (normalized % 10) {
    case 1: return `${normalized}st`
    case 2: return `${normalized}nd`
    case 3: return `${normalized}rd`
    default: return `${normalized}th`
  }
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
  const resolvedHospitalBill = fmt(
    textOrNull(hospital.typeOfBill)
    ?? 'hospitalization expenses'
  )
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
  const plainAssistanceKinds = Array.isArray((caseData.plainDetails as any)?.assistanceKinds)
    ? [...new Set((caseData.plainDetails as any).assistanceKinds
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim().toLowerCase())
        .filter(Boolean))]
    : []
  const resolvedMedicalRequestedAssistance = fmt(resolveMedicalRequestedAssistance(caseData))
  const resolvedMedicalProcedureLabel =
    resolvedMedicalRequestedAssistance !== '-'
      ? resolvedMedicalRequestedAssistance
      : 'medical procedure/examination'

  const clientName = `${c.lastName}, ${[c.firstName, c.middleName].filter(Boolean).join(' ')}`
  const fullName   = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ')
  const resolvedPatientName = fmt(textOrNull(hospital.patientName) ?? textOrNull(fullName))
  const address    = [c.barangay, c.municipality, c.province].filter(Boolean).join(', ') || '-'
  // When a case is created for a household member found in the client's family
  // composition (rather than the client themself), these overrides carry that
  // person's identity so the report doesn't print the client's own details instead.
  const beneficiaryOverrideName = textOrNull((caseData as any).beneficiaryName)
  const beneficiaryOverrideAge = textOrNull((caseData as any).beneficiaryAge)
  const beneficiaryOverrideSex = textOrNull((caseData as any).beneficiarySex)
  const beneficiaryOverrideCivilStatus = textOrNull((caseData as any).beneficiaryCivilStatus)
  const beneficiaryOverrideOccupation = textOrNull((caseData as any).beneficiaryOccupation)
  const beneficiaryOverrideRequestorName = textOrNull((caseData as any).beneficiaryRequestorName)
  const beneficiaryOverrideRequestorRelationship = textOrNull((caseData as any).beneficiaryRequestorRelationship)
  const resolvedDeceasedAddress = fmt(textOrNull((burial as any).deceasedAddress) ?? textOrNull(address))
  const resolvedAddress = caseData.assistanceType === 'burial' ? resolvedDeceasedAddress : address
  const resolvedDeceasedName = fmt(textOrNull((burial as any).deceasedName) ?? textOrNull(fullName))
  const resolvedDeceasedAge = fmt(textOrNull((burial as any).deceasedAge) ?? calcAge(c.dateOfBirth))
  const resolvedDeceasedOccupation = fmt(textOrNull((burial as any).deceasedOccupation) ?? textOrNull(c.occupation))
  const resolvedDeceasedCivilStatus = fmt(textOrNull((burial as any).deceasedCivilStatus) ?? textOrNull(c.civilStatus))
  const resolvedDeceasedSex = fmt(textOrNull((burial as any).deceasedSex) ?? textOrNull(c.sex))
  const resolvedBeneficiaryName = caseData.assistanceType === 'burial' ? resolvedDeceasedName : fmt(beneficiaryOverrideName ?? fullName)
  const resolvedBeneficiaryNameList = caseData.assistanceType === 'burial'
    ? resolvedDeceasedName
    // A beneficiary override is often a single informal name (e.g. "PAPANG"), so it
    // can't be reliably reformatted into "Last, First" the way the client's own name is.
    : fmt(beneficiaryOverrideName ?? clientName)
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
  const plainConformeName = textOrNull((caseData.plainDetails as any)?.conformeName)
  const plainConformeRelationship = textOrNull((caseData.plainDetails as any)?.conformeRelationship)
  const resolvedBurialRequestorName = caseData.assistanceType === 'burial' ? fmt(burialConformeName ?? textOrNull(fullName)) : resolvedProxyName
  const resolvedBurialRequestorNameList = caseData.assistanceType === 'burial' ? resolvedBurialRequestorName : resolvedProxyNameList
  const medicineConformeName = textOrNull((medicine as any).conformeName)
  const medicineConformeRelationship = textOrNull((medicine as any).conformeRelationship)
  const hasMedicineRequestingParty = caseData.assistanceType === 'medicine' && Boolean(medicineConformeName)
  const shouldBlankRequestor =
    !beneficiaryOverrideRequestorName
    && ((caseData.assistanceType === 'medicine' && !medicineConformeName && !medicineConformeRelationship)
    || (caseData.assistanceType === 'hospital' && !hospitalConformeName && !hospitalConformeRelationship)
    || (caseData.assistanceType === 'medical' && !medicalConformeName && !medicalConformeRelationship)
    || (caseData.assistanceType === 'burial' && !burialConformeName && !burialConformeRelationship)
    || (caseData.assistanceType === 'eyeglass' && !eyeglassConformeName && !eyeglassConformeRelationship)
    || (caseData.assistanceType === 'plain' && !plainConformeName && !plainConformeRelationship))
  const allowSelfRelationship =
    !((caseData.assistanceType === 'hospital' && hospital.templateType === 'proxy')
      || (caseData.assistanceType === 'medicine' && (medicineTemplateType === 'proxy' || hasMedicineRequestingParty))
      || (caseData.assistanceType === 'medical' && medicalTemplateType === 'proxy')
      || (caseData.assistanceType === 'eyeglass' && eyeglassTemplateType === 'proxy'))
  // When a beneficiary override is present, the client is NOT the beneficiary, so
  // defaulting the requesting party to "the client, Self" (the fallback below, used
  // when the client IS the beneficiary) would be wrong. Leave it blank instead unless
  // someone explicitly filled in who is requesting on the beneficiary's behalf.
  const resolvedConformeName = fmt(
    beneficiaryOverrideRequestorName
    ?? eyeglassConformeName
    ?? medicineConformeName
    ?? hospitalConformeName
    ?? medicalConformeName
    ?? burialConformeName
    ?? plainConformeName
    ?? textOrNull(hospital.patientName)
    ?? (beneficiaryOverrideName ? null : textOrNull(fullName))
  )
  const resolvedRelationship = fmt(
    beneficiaryOverrideRequestorRelationship
    ?? eyeglassConformeRelationship
    ?? medicineConformeRelationship
    ?? hospitalConformeRelationship
    ?? medicalConformeRelationship
    ?? burialConformeRelationship
    ?? plainConformeRelationship
    ?? (beneficiaryOverrideName ? null : hasMedicineRequestingParty ? 'N/A' : allowSelfRelationship ? 'Self' : null)
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
  const plainHasKind = (kind: string) => caseData.assistanceType === 'plain' && plainAssistanceKinds.includes(kind)
  const hasHospitalRequest = isAssistanceType('hospital') || plainHasKind('hospital')
  const hasMedicalRequest = isAssistanceType('medical') || plainHasKind('medical')
  const hasEyeglassRequest = isAssistanceType('eyeglass')
  const hasMedicineRequest = isAssistanceType('medicine')
  const hasBurialRequest = isAssistanceType('burial') || plainHasKind('burial')
  const hasOtherPlainRequest = false
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
  const isMedicine = hasMedicineRequest
  const isMedical = hasMedicalRequest
  const isBurial = hasBurialRequest
  const isHospital = hasHospitalRequest
  const isSubsequentAvailment = Boolean((caseData as any).isSubsequentAvailment)
  const resolvedRequestingParty = shouldBlankRequestor ? '' : resolvedConformeName
  const resolvedRelationshipToBeneficiary = shouldBlankRequestor ? '' : resolvedRelationship
  const isSelfRequest = ['self', '-', ''].includes(String(resolvedRelationshipToBeneficiary).trim().toLowerCase())
  const resolvedRequestingPartyPhrase = shouldBlankRequestor
    ? 'The beneficiary'
    : isSelfRequest
      ? resolvedBeneficiaryName
      : `${resolvedRequestingParty}, the ${resolvedRelationshipToBeneficiary} of the beneficiary,`
  const resolvedServiceProviderName = fmt(resolveServiceProviderName(caseData))
  const resolvedAssistancePurpose = fmt(resolveAssistancePurpose(caseData))
  const usesGenericPlainAssistancePurpose =
    caseData.assistanceType === 'plain'
    && normalizeForCompare(resolvedAssistancePurpose) === 'emergency assistance'
  const rawPresentingProblem = textOrNull(caseData.presentingProblem)
  const burialFuneralHome = textOrNull(burial.funeralHome)
  const burialProblemMentionsFuneralHome =
    caseData.assistanceType === 'burial'
    && !!rawPresentingProblem
    && !!burialFuneralHome
    && normalizeForCompare(rawPresentingProblem).includes(normalizeForCompare(burialFuneralHome))
  const burialProblemIsOnlyFuneralHome =
    caseData.assistanceType === 'burial'
    && !!rawPresentingProblem
    && !!burialFuneralHome
    && normalizeForCompare(rawPresentingProblem) === normalizeForCompare(burialFuneralHome)
  const rawSpecificNeed =
    caseData.assistanceType === 'hospital' && resolvedHospitalName !== '-'
      ? `${resolvedAssistancePurpose} at ${resolvedHospitalName}`
    : caseData.assistanceType === 'medical' && resolvedClinicName !== '-'
      ? `${resolvedAssistancePurpose} at ${resolvedClinicName}`
    : caseData.assistanceType === 'burial' && fmt(burial.funeralHome) !== '-' && !burialProblemMentionsFuneralHome
      ? `${resolvedAssistancePurpose} at ${fmt(burial.funeralHome)}`
    : usesGenericPlainAssistancePurpose
      ? ''
    : resolvedAssistancePurpose
  const resolvedSpecificNeed = rawSpecificNeed ? fmt(rawSpecificNeed) : ''
  const resolvedImmediateCircumstance = fmt(
    burialProblemIsOnlyFuneralHome && burialFuneralHome
      ? `with pending funeral charges at ${burialFuneralHome}`
    : rawPresentingProblem
    ?? (resolvedDiagnosis !== '-' ? resolvedDiagnosis : null)
    ?? (resolvedFindings !== '-' ? resolvedFindings : null)
  )
  const resolvedIncomeSituation = fmt(textOrNull((caseData as any).incomeSituation) ?? 'limited and irregular income')
  const resolvedCaseSpecificFindings = resolvedFindings
  const resolvedEvaluationRecommendation = caseData.assistanceType === 'medicine'
    ? `In view of the above, the undersigned recommends that the beneficiary avail of financial assistance from the City Government through the Assistance to Individuals in Crisis Situation (AICS) Program, for ${resolvedAssistancePurpose}, in the amount of ${amountToWords(Number(amount))} (P${Number(amount).toFixed(2)}).`
    : caseData.assistanceType === 'plain'
      ? `In view of the above, the undersigned recommends that the beneficiary avail of financial assistance from the City Government through the Assistance to Individuals in Crisis Situation (AICS) Program, through a Plain AICS, for ${resolvedAssistancePurpose}, in the amount of ${amountToWords(Number(amount))} (P${Number(amount).toFixed(2)}).`
      : `In view of the above, the undersigned recommends that the beneficiary avail of financial assistance from the City Government through the Assistance to Individuals in Crisis Situation (AICS) Program, through a Guarantee Letter addressed to ${resolvedServiceProviderName}, for ${resolvedAssistancePurpose}, in the amount of ${amountToWords(Number(amount))} (P${Number(amount).toFixed(2)}).`
  // A stage's signature snapshot can be empty (e.g. the actor had not saved an
  // e-signature yet when they acted). Once that stage has genuinely been acted
  // on, fall back to that role's current assignee signature rather than
  // printing a blank box. Stages that haven't happened yet stay blank.
  const stageSignature = (stage: 'for_review' | 'recommending_approval' | 'for_approval', snapshot: string | null) => {
    if (snapshot) return snapshot
    if (!(caseData as any).approvals?.[stage]) return null
    return textOrNull((caseData as any).approvalSignatureFallbacks?.[stage]?.signatureUrl)
  }

  const reviewedByName = fmt(textOrNull((caseData as any).reviewedByName))
  const reviewedByTitle = fmt(textOrNull((caseData as any).reviewedByTitle) ?? 'Social Welfare Officer II')
  const reviewedByDate = formatLongDate((caseData as any).reviewedByDate)
  const reviewedBySignature = stageSignature('for_review', textOrNull((caseData as any).reviewedBySignature))

  const recommendingByName = fmt(textOrNull((caseData as any).recommendingByName))
  const recommendingByTitle = fmt(textOrNull((caseData as any).recommendingByTitle) ?? "City Social Welfare and Dev't. Officer")
  const recommendingByDate = formatLongDate((caseData as any).recommendingByDate)
  const recommendingBySignature = stageSignature('recommending_approval', textOrNull((caseData as any).recommendingBySignature))

  const approvedByName = fmt(textOrNull((caseData as any).approvedByName))
  const approvedByTitle = fmt(textOrNull((caseData as any).approvedByTitle) ?? 'City Mayor')
  const approvedByDate = formatLongDate((caseData as any).approvedByDate)
  const approvedBySignature = stageSignature('for_approval', textOrNull((caseData as any).approvedBySignature))

  // Build per-user signature entries (e.g. { maribelleArtienda: '<url>' })
  // Always include the key even when no URL so templates don't render "undefined" for missing keys.
  const userSignatureParams: Record<string, string | null> = {}
  const signatureUserNames: Record<string, string> = {}
  const allSignatureParamKeys: string[] = []
  const signatureUsers = (caseData as any).signatureUsers ?? {}
  for (const [signatureParam, user] of Object.entries(signatureUsers) as Array<[string, any]>) {
    if (!/^[a-zA-Z0-9_]+$/.test(signatureParam)) continue
    userSignatureParams[signatureParam] = user?.signatureUrl ?? null
    signatureUserNames[`${signatureParam}Name`] = fmt(textOrNull(user?.name))
    allSignatureParamKeys.push(signatureParam)
  }
  for (const stage of ['for_review', 'recommending_approval', 'for_approval'] as const) {
    const approval = (caseData as any).approvals?.[stage] ?? (caseData as any).approvalSignatureFallbacks?.[stage]
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
    ...signatureUserNames,
    // Internal marker so renderDoc knows which dynamic keys are signature image tags.
    __sigParamKeys: allSignatureParamKeys,

    // Header
    dateOfAssessment:    resolvedDateOfAssessment,
    caseNumber:          fmt(caseData.caseNumber),

    // Global CGV AICS template checkboxes and labels
    hospitalCheckBox:    checkbox(hasHospitalRequest),
    medicalCheckBox:     checkbox(hasMedicalRequest),
    eyeglassCheckBox:    checkbox(hasEyeglassRequest),
    medicineCheckBox:    checkbox(hasMedicineRequest),
    burialCheckBox:      checkbox(hasBurialRequest),
    otherAssistanceCheckBox: checkbox(hasOtherPlainRequest),
    otherAssistanceText: isAssistanceType('plain') && resolvedNatureOfAssistance !== '-' ? resolvedNatureOfAssistance : '',
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
    reqMedicineEyeglassCertificate: checkbox(hasEyeglassRequest && isReqSubmitted('prescription')),
    reqMedicalPriceQuotation: checkbox(isMedical && isReqSubmitted('price_quotation')),
    reqHospitalPromissoryNote: checkbox(isHospital && isReqSubmitted('promissory_note')),
    reqBurialPromissoryNote: checkbox(isHospital && isReqSubmitted('promissory_note')),
    reqHospitalCertificateIndigency: checkbox(isHospital && isReqSubmitted('indigency')),
    reqMedicineCertificateIndigency: checkbox(isMedicine && isReqSubmitted('indigency')),
    reqMedicalCertificateIndigency: checkbox(isMedical && isReqSubmitted('indigency')),
    reqEyeglassCertificateIndigency: checkbox(hasEyeglassRequest && isReqSubmitted('indigency')),
    reqBurialCertificateIndigency: checkbox(isBurial && isReqSubmitted('indigency')),
    reqHospitalPhotocopyId: checkbox(isHospital && isReqSubmitted('id_copy')),
    reqMedicinePhotocopyId: checkbox(isMedicine && isReqSubmitted('id_copy')),
    reqMedicalPhotocopyId: checkbox(isMedical && isReqSubmitted('id_copy')),
    reqEyeglassPhotocopyId: checkbox(hasEyeglassRequest && isReqSubmitted('id_copy')),
    reqBurialPhotocopyId: checkbox(isBurial && isReqSubmitted('id_copy')),
    reqMedicineCertificateNoAvailableMedicine: checkbox(isMedicine && isReqSubmitted('cho_cert')),
    reqPlainSalesInvoice: checkbox(isAssistanceType('plain') && isReqSubmitted('sales_invoice')),

    // Backward-compatible aliases for older templates.
    reqLetterRequest:     checkbox(hasMedicineRequest && isReqSubmitted('personal_letter')),
    reqRequestForm:       checkbox(hasMedicalRequest && isReqSubmitted('med_request')),
    reqClinicalAbstract:  checkbox(hasHospitalRequest && isReqSubmitted('clinical_abstract')),
    reqDeathCertificate:  checkbox(hasBurialRequest && isReqSubmitted('death_cert')),
    reqMedicalCertificate: checkbox(hasMedicineRequest && isReqSubmitted('medical_cert')),
    reqMedicalCertificateMedical: checkbox(hasMedicalRequest && isReqSubmitted('medical_cert')),
    reqFinalBill:         checkbox(hasHospitalRequest && isReqSubmitted('final_bill')),
    reqBillingStatement:  checkbox(hasBurialRequest && isReqSubmitted('billing_stmt', 'hospital_bill')),
    reqPrescription:      checkbox(hasMedicineRequest && isReqSubmitted('prescription')),
    reqPriceQuotation:    checkbox(hasMedicalRequest && isReqSubmitted('price_quotation')),
    reqPromissoryNote:    checkbox(hasHospitalRequest && isReqSubmitted('promissory_note')),
    reqCertificateIndigency: checkbox(hasMedicineRequest && isReqSubmitted('indigency')),
    reqCertificateIndigencyMedical: checkbox(hasMedicalRequest && isReqSubmitted('indigency')),
    reqCertificateIndigencyBurial: checkbox(hasHospitalRequest && isReqSubmitted('indigency')),
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
    age:                 caseData.assistanceType === 'burial' ? resolvedDeceasedAge : fmt(beneficiaryOverrideAge ?? calcAge(c.dateOfBirth)),
    dateOfBirth:         caseData.assistanceType === 'burial' ? '-' : beneficiaryOverrideName ? '-' : fmt(c.dateOfBirth),
    occupation:          caseData.assistanceType === 'burial' ? resolvedDeceasedOccupation : fmt(beneficiaryOverrideOccupation ?? textOrNull(c.occupation)),
    religion:            fmt((c as any).religion),
    civilStatus:         caseData.assistanceType === 'burial' ? resolvedDeceasedCivilStatus : fmt(beneficiaryOverrideCivilStatus ?? textOrNull(c.civilStatus)),
    sex:                 caseData.assistanceType === 'burial' ? resolvedDeceasedSex : fmt(beneficiaryOverrideSex ?? textOrNull(c.sex)),
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
    presentingProblem:   resolvedImmediateCircumstance,
    backgroundOfProblem: fmt(caseData.backgroundOfProblem),
    assessment:          fmt(caseData.assessment),
    findings:            resolvedFindings,
    problemPresented:    resolvedImmediateCircumstance,
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
    serviceProviderAddress: fmt(resolveServiceProviderAddress(caseData)),
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
    medicalType:         resolvedMedicalProcedureLabel,
    medicalProcedure:    resolvedMedicalProcedureLabel,
    procedureType:       resolvedMedicalProcedureLabel,
    diagnosedType:       fmt(textOrNull(medical.diagnosedType)),
    operationType:       resolvedMedicalProcedureLabel,

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
      if (tagName === 'documentQrCode') return [80, 80]
      // Deliberately smaller than a "real" signature scan would be: at the original
      // 160x58 size the picture was taller than 3 lines of this text, which is what made
      // precise vertical placement over the name so fragile (see the centering/lift logic
      // below) and prone to spilling into neighboring lines in some renderers. Shrinking it
      // keeps it fully intact and legibly attached to its name with much less positioning
      // precision required.
      return [130, 45]
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

function paragraphTextContent(paragraph: Element): string {
  return Array.from(paragraph.getElementsByTagName('w:t'))
    .map((node) => node.textContent ?? '')
    .join('')
}

function paragraphHasVisibleContent(paragraph: Element): boolean {
  if ((paragraphTextContent(paragraph)).trim().length > 0) return true
  if (paragraph.getElementsByTagName('w:drawing').length > 0) return true
  if (paragraph.getElementsByTagName('w:pict').length > 0) return true
  if (paragraph.getElementsByTagName('mc:AlternateContent').length > 0) return true
  return false
}

function normalizeBeneficiaryValueText(value: string): string {
  return value
    .replace(/^[\s\u00A0:]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cloneRunWithText(doc: Document, templateRun: Element | null, text: string): Element {
  const run = templateRun
    ? templateRun.cloneNode(true) as Element
    : doc.createElement('w:r')

  for (const child of Array.from(run.childNodes)) {
    if (child.nodeName !== 'w:rPr') {
      run.removeChild(child)
    }
  }

  const textNode = doc.createElement('w:t')
  if (/^\s|\s$/.test(text)) {
    textNode.setAttribute('xml:space', 'preserve')
  }
  textNode.textContent = text
  run.appendChild(textNode)
  return run
}

function buildTabRun(doc: Document, templateRun: Element | null): Element {
  const run = templateRun
    ? templateRun.cloneNode(true) as Element
    : doc.createElement('w:r')
  for (const child of Array.from(run.childNodes)) {
    if (child.nodeName !== 'w:rPr') {
      run.removeChild(child)
    }
  }
  run.appendChild(doc.createElement('w:tab'))
  return run
}

function ensureParagraphTabStops(doc: Document, paragraph: Element, positions: string[]) {
  let pPr = Array.from(paragraph.childNodes).find((node) => node.nodeName === 'w:pPr') as Element | undefined
  if (!pPr) {
    pPr = doc.createElement('w:pPr')
    paragraph.insertBefore(pPr, paragraph.firstChild)
  }

  for (const existingTabs of Array.from(pPr.childNodes).filter((node) => node.nodeName === 'w:tabs')) {
    pPr.removeChild(existingTabs)
  }

  const tabs = doc.createElement('w:tabs')
  for (const position of positions) {
    const tab = doc.createElement('w:tab')
    tab.setAttribute('w:val', 'left')
    tab.setAttribute('w:pos', position)
    tabs.appendChild(tab)
  }
  // w:tabs must precede indentation, alignment, run properties, and section properties.
  // LibreOffice ignores out-of-order paragraph properties and falls back to default tabs.
  const propertiesAfterTabs = new Set([
    'w:suppressAutoHyphens',
    'w:kinsoku',
    'w:wordWrap',
    'w:overflowPunct',
    'w:topLinePunct',
    'w:autoSpaceDE',
    'w:autoSpaceDN',
    'w:bidi',
    'w:adjustRightInd',
    'w:snapToGrid',
    'w:spacing',
    'w:ind',
    'w:contextualSpacing',
    'w:mirrorIndents',
    'w:suppressOverlap',
    'w:jc',
    'w:textDirection',
    'w:textAlignment',
    'w:textboxTightWrap',
    'w:outlineLvl',
    'w:divId',
    'w:cnfStyle',
    'w:rPr',
    'w:sectPr',
    'w:pPrChange',
  ])
  const insertionPoint = Array.from(pPr.childNodes).find((node) => propertiesAfterTabs.has(node.nodeName)) ?? null
  pPr.insertBefore(tabs, insertionPoint)
}

function normalizeBeneficiaryInfoParagraphs(doc: Document): boolean {
  const targets = [
    'Name of Beneficiary',
    'Address',
    'Age',
    'Sex Assigned at Birth',
    'Civil Status',
    'Occupation',
    'Religion',
    'Requesting Party (if not the beneficiary)',
    'Relationship to Beneficiary',
    'Contact No.',
  ]
  let changed = false

  for (const paragraph of Array.from(doc.getElementsByTagName('w:p'))) {
    const text = paragraphTextContent(paragraph).trim()
    const prefix = targets.find((candidate) => text.startsWith(candidate))
    if (!prefix) continue

    const value = normalizeBeneficiaryValueText(text.slice(prefix.length))
    const runs = Array.from(paragraph.getElementsByTagName('w:r'))
    const labelRun = runs[0] ?? null
    const colonRun = runs.find((run) => paragraphTextContent(run).includes(':')) ?? labelRun
    const valueRun = runs.find((run) => {
      const runText = paragraphTextContent(run).trim()
      return runText.length > 0 && runText !== ':' && runText !== prefix
    }) ?? labelRun

    for (const child of Array.from(paragraph.childNodes)) {
      if (child.nodeName !== 'w:pPr') {
        paragraph.removeChild(child)
      }
    }

    // One CGV reference column prevents long labels from skipping to a second tab stop.
    ensureParagraphTabStops(doc, paragraph, ['4680'])
    paragraph.appendChild(cloneRunWithText(doc, labelRun, prefix))
    paragraph.appendChild(buildTabRun(doc, labelRun))
    paragraph.appendChild(cloneRunWithText(doc, colonRun, ': '))

    const rebuiltValueRun = cloneRunWithText(doc, valueRun, value)
    paragraph.appendChild(rebuiltValueRun)
    changed = true
  }

  return changed
}

// The template carries at least one purely decorative floating textbox (originally meant
// to frame the CHO "unavailable medicines" certification block) whose content is just an
// empty paragraph — it has no text and no picture. When that certification section is
// blank (the normal case: no unavailable medicines on the case), this empty shape is left
// behind anyway, with a large template-authored footprint that has nothing to do with any
// signature. In Word it's an invisible-but-selectable box that can span several sections
// (confirmed by a user screenshot showing its selection handles stretching from the
// preparer's line down past the recommender's). Since a real signature/QR textbox always
// contains an actual picture by the time this runs (docxtemplater has already substituted
// it in), any textbox with neither text nor a picture is dead weight — remove its whole
// hosting run.
function removeEmptyDecorativeTextBoxes(doc: Document): boolean {
  let changed = false

  for (const txbxContent of Array.from(doc.getElementsByTagName('w:txbxContent'))) {
    const hasText = Array.from(txbxContent.getElementsByTagName('w:t'))
      .some((t) => (t.textContent ?? '').trim().length > 0)
    const hasPicture = txbxContent.getElementsByTagName('w:drawing').length > 0
      || txbxContent.getElementsByTagName('pic:pic').length > 0
    if (hasText || hasPicture) continue

    let node: Node | null = txbxContent
    let hostRun: Element | null = null
    while (node) {
      if (node.nodeName === 'w:r') {
        hostRun = node as Element
        break
      }
      node = node.parentNode
    }
    if (hostRun?.parentNode) {
      hostRun.parentNode.removeChild(hostRun)
      changed = true
    }
  }

  return changed
}

function trimTrailingEmptyParagraphs(doc: Document): boolean {
  const bodies = doc.getElementsByTagName('w:body')
  const body = bodies[0]
  if (!body) return false

  let changed = false
  let cursor = body.lastChild
  while (cursor && cursor.nodeName === 'w:sectPr') {
    cursor = cursor.previousSibling
  }

  while (cursor && cursor.nodeName === 'w:p') {
    const paragraph = cursor as Element
    if (paragraphHasVisibleContent(paragraph)) break
    const previous = cursor.previousSibling
    body.removeChild(cursor)
    cursor = previous
    changed = true
  }

  return changed
}

function compactCaseStudySignatureSection(doc: Document): boolean {
  const body = doc.getElementsByTagName('w:body')[0]
  if (!body) return false

  let inSignatureSection = false
  let preserveNextSignatureParagraph = false
  let changed = false

  for (const child of Array.from(body.childNodes)) {
    if (child.nodeName !== 'w:p') continue
    const paragraph = child as Element
    const text = paragraphTextContent(paragraph).trim()

    if (text.includes('Prepared and submitted by:')) {
      inSignatureSection = true
      continue
    }
    if (text === 'Reviewed by:' || text === 'Recommending Approval:') {
      preserveNextSignatureParagraph = true
      continue
    }
    if (preserveNextSignatureParagraph) {
      preserveNextSignatureParagraph = false
      continue
    }
    if (!inSignatureSection || paragraphHasVisibleContent(paragraph)) continue

    body.removeChild(paragraph)
    changed = true
  }

  return changed
}

function ensureParagraphJustification(doc: Document, paragraph: Element, justification: string): boolean {
  let pPr = Array.from(paragraph.childNodes).find((node) => node.nodeName === 'w:pPr') as Element | undefined
  if (!pPr) {
    pPr = doc.createElement('w:pPr')
    paragraph.insertBefore(pPr, paragraph.firstChild)
  }

  const existing = Array.from(pPr.childNodes).filter((node) => node.nodeName === 'w:jc') as Element[]
  if (existing.length === 1 && existing[0].getAttribute('w:val') === justification) return false

  for (const node of existing) {
    pPr.removeChild(node)
  }

  const alignment = doc.createElement('w:jc')
  alignment.setAttribute('w:val', justification)
  const propertiesAfterJustification = new Set([
    'w:textDirection',
    'w:textAlignment',
    'w:textboxTightWrap',
    'w:outlineLvl',
    'w:divId',
    'w:cnfStyle',
    'w:rPr',
    'w:sectPr',
    'w:pPrChange',
  ])
  const insertionPoint = Array.from(pPr.childNodes).find((node) => propertiesAfterJustification.has(node.nodeName)) ?? null
  pPr.insertBefore(alignment, insertionPoint)
  return true
}

function ensureParagraphMinimumLine(doc: Document, paragraph: Element, lineTwips: string): boolean {
  let pPr = Array.from(paragraph.childNodes).find((node) => node.nodeName === 'w:pPr') as Element | undefined
  if (!pPr) {
    pPr = doc.createElement('w:pPr')
    paragraph.insertBefore(pPr, paragraph.firstChild)
  }

  let spacing = Array.from(pPr.childNodes).find((node) => node.nodeName === 'w:spacing') as Element | undefined
  if (spacing?.getAttribute('w:line') === lineTwips && spacing.getAttribute('w:lineRule') === 'atLeast') return false

  if (!spacing) {
    spacing = doc.createElement('w:spacing')
    const propertiesAfterSpacing = new Set([
      'w:ind',
      'w:contextualSpacing',
      'w:mirrorIndents',
      'w:suppressOverlap',
      'w:jc',
      'w:textDirection',
      'w:textAlignment',
      'w:textboxTightWrap',
      'w:outlineLvl',
      'w:divId',
      'w:cnfStyle',
      'w:rPr',
      'w:sectPr',
      'w:pPrChange',
    ])
    const insertionPoint = Array.from(pPr.childNodes)
      .find((node) => propertiesAfterSpacing.has(node.nodeName)) ?? null
    pPr.insertBefore(spacing, insertionPoint)
  }
  spacing.setAttribute('w:line', lineTwips)
  spacing.setAttribute('w:lineRule', 'atLeast')
  return true
}

function ensureParagraphSpacingBefore(doc: Document, paragraph: Element, beforeTwips: string): boolean {
  let pPr = Array.from(paragraph.childNodes).find((node) => node.nodeName === 'w:pPr') as Element | undefined
  if (!pPr) {
    pPr = doc.createElement('w:pPr')
    paragraph.insertBefore(pPr, paragraph.firstChild)
  }

  let spacing = Array.from(pPr.childNodes).find((node) => node.nodeName === 'w:spacing') as Element | undefined
  if (spacing?.getAttribute('w:before') === beforeTwips) return false
  if (!spacing) {
    spacing = doc.createElement('w:spacing')
    const propertiesAfterSpacing = new Set([
      'w:ind', 'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc',
      'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl',
      'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange',
    ])
    const insertionPoint = Array.from(pPr.childNodes)
      .find((node) => propertiesAfterSpacing.has(node.nodeName)) ?? null
    pPr.insertBefore(spacing, insertionPoint)
  }
  spacing.setAttribute('w:before', beforeTwips)
  return true
}

const EMU_PER_POINT = 12700
// The runtime signature picture is always sized [130, 45] px by the image module's
// getSize() callback below (see `imageModule`), i.e. 1238250 x 428625 EMU = 97.5 x 33.75pt.
const SIGNATURE_IMAGE_WIDTH_EMU = 1238250
const SIGNATURE_IMAGE_HEIGHT_EMU = 428625
const SIGNATURE_IMAGE_WIDTH_POINTS = SIGNATURE_IMAGE_WIDTH_EMU / EMU_PER_POINT
const SIGNATURE_IMAGE_HEIGHT_POINTS = SIGNATURE_IMAGE_HEIGHT_EMU / EMU_PER_POINT
// Each anchor point is the TOP of the name's own line. At the picture's original 43.5pt
// height (roughly 3 lines of this text) that mismatch needed a real lift to keep the ink
// off the line(s) below — scaled down proportionally now that the picture itself (33.75pt)
// is shrunk to close to one line, since most of the earlier overflow problem no longer
// applies. The two mechanisms still need different amounts in real Word: the preparer's
// DrawingML anchor (embedded in the same paragraph as its name) vs. the other three's VML
// shapes (hosted in their own dedicated paragraph immediately before the name), confirmed
// against real Word screenshots, not just LibreOffice.
const SIGNATURE_VERTICAL_LIFT_DRAWINGML_POINTS = 4
const SIGNATURE_VERTICAL_LIFT_VML_POINTS = 1

// docx/OOXML has no text-metrics API of its own, so centering needs a real font's glyph
// metrics measured some other way. pdfkit (already a direct dependency, used elsewhere for
// the PDFKit-fallback reports) can load an arbitrary TTF and report real advance widths via
// widthOfString — but only if we hand it a font that actually exists wherever this runs.
// These name paragraphs are Georgia Bold (reviewer/recommender/approver) or Arial Bold
// (preparer) in the template, but Georgia/Arial themselves aren't installed in the backend's
// own Docker image — LibreOffice there substitutes Noto Serif / Liberation Sans (confirmed
// via `fc-match` inside the container), and that substitution, not the nominal template font,
// is what actually determines rendered glyph widths in the PDF this centering has to match.
// Falls back to the old rough per-character estimate (calibrated against real Word
// screenshots) if none of the candidates exist — e.g. a dev machine without these exact
// font files — so this never throws or produces a worse result than before.
const NAME_FONT_CANDIDATES = {
  'georgia-bold': [
    'C:\\Windows\\Fonts\\georgiab.ttf',
    '/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
  ],
  'arial-bold': [
    'C:\\Windows\\Fonts\\arialbd.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ],
} as const
type NameFontFamily = keyof typeof NAME_FONT_CANDIDATES
const nameFontMeasurerCache = new Map<NameFontFamily, ((text: string, fontSizePt: number) => number) | null>()

function getNameFontMeasurer(fontFamily: NameFontFamily): ((text: string, fontSizePt: number) => number) | null {
  if (nameFontMeasurerCache.has(fontFamily)) return nameFontMeasurerCache.get(fontFamily) ?? null

  let measurer: ((text: string, fontSizePt: number) => number) | null = null
  const fontPath = NAME_FONT_CANDIDATES[fontFamily].find((candidate) => fs.existsSync(candidate))
  if (fontPath) {
    try {
      const measuringDoc = new PDFDocument({ autoFirstPage: false })
      measuringDoc.registerFont('measure', fontPath)
      measuringDoc.font('measure')
      measurer = (text, fontSizePt) => measuringDoc.fontSize(fontSizePt).widthOfString(text)
    } catch {
      measurer = null
    }
  }
  nameFontMeasurerCache.set(fontFamily, measurer)
  return measurer
}

function estimateTextWidthPoints(text: string, fontSizePt: number, fontFamily: NameFontFamily = 'georgia-bold'): number {
  const trimmed = text.trim()
  const measurer = getNameFontMeasurer(fontFamily)
  if (measurer) {
    try {
      return measurer(trimmed, fontSizePt)
    } catch {
      // fall through to the heuristic below
    }
  }
  const AVERAGE_CHAR_WIDTH_FACTOR = 0.85
  return Math.max(0, trimmed.length) * fontSizePt * AVERAGE_CHAR_WIDTH_FACTOR
}

// Recenters a floating/VML signature shape over a specific printed name by rewriting its
// own horizontal offset from that name's estimated width — the name paragraph itself is
// left untouched (still left-aligned), only the shape's offset is name-length-aware.
function centerSignatureOverName(
  doc: Document,
  shapeHost: Element,
  nameText: string,
  fontSizePt: number,
  fontFamily: NameFontFamily = 'georgia-bold',
): void {
  const nameWidthPoints = estimateTextWidthPoints(nameText, fontSizePt, fontFamily)

  for (const anchor of Array.from(shapeHost.getElementsByTagName('wp:anchor'))) {
    const extent = anchor.getElementsByTagName('wp:extent')[0]
    const anchorWidthEmu = Number(extent?.getAttribute('cx') ?? 0)
    if (!anchorWidthEmu) continue
    const offsetEmu = Math.max(0, Math.round((nameWidthPoints * EMU_PER_POINT - anchorWidthEmu) / 2))
    const positionH = anchor.getElementsByTagName('wp:positionH')[0]
    if (!positionH) continue
    while (positionH.firstChild) positionH.removeChild(positionH.firstChild)
    positionH.setAttribute('relativeFrom', 'column')
    const posOffsetEl = doc.createElement('wp:posOffset')
    posOffsetEl.textContent = String(offsetEmu)
    positionH.appendChild(posOffsetEl)

    const positionV = anchor.getElementsByTagName('wp:positionV')[0]
    const vOffsetEl = positionV?.getElementsByTagName('wp:posOffset')[0]
    if (vOffsetEl) {
      const currentVEmu = Number(vOffsetEl.textContent ?? 0)
      vOffsetEl.textContent = String(Math.round(currentVEmu - SIGNATURE_VERTICAL_LIFT_DRAWINGML_POINTS * EMU_PER_POINT))
    }
    // The template floats these behind the text ("Send Behind Text") specifically so its
    // own opaque white shape fill (below) doesn't blot out the printed name — some
    // renderers (confirmed in LibreOffice) instead paint each paragraph's own opaque
    // background over behind-text shapes, hiding whichever part of the signature falls
    // within a paragraph's box and only showing the sliver in the blank space between
    // paragraphs. Bringing the shape in front only works once its fill is transparent too
    // (next), otherwise it just paints over the name instead of alongside it.
    if (anchor.getAttribute('behindDoc') === '1') {
      anchor.setAttribute('behindDoc', '0')
    }
  }

  for (const shapeProperties of Array.from(shapeHost.getElementsByTagName('wps:spPr'))) {
    for (const fill of Array.from(shapeProperties.getElementsByTagName('a:solidFill'))) {
      if (fill.parentNode !== shapeProperties) continue
      const noFill = doc.createElement('a:noFill')
      fill.parentNode.replaceChild(noFill, fill)
    }
  }

  for (const shape of Array.from(shapeHost.getElementsByTagName('v:shape'))) {
    const style = shape.getAttribute('style') ?? ''
    const widthMatch = style.match(/(?:^|;)width:([\d.]+)pt(?:;|$)/)
    const shapeWidthPoints = Number(widthMatch?.[1])
    if (!Number.isFinite(shapeWidthPoints) || shapeWidthPoints <= 0) continue
    const offsetPoints = Math.max(0, (nameWidthPoints - shapeWidthPoints) / 2)
    const offsetStr = offsetPoints.toFixed(2).replace(/\.?0+$/, '') || '0'
    let nextStyle = /(?:^|;)margin-left:[^;]*/.test(style)
      ? style.replace(/margin-left:[^;]*/, `margin-left:${offsetStr}pt`)
      : `${style}${style.endsWith(';') || style.length === 0 ? '' : ';'}margin-left:${offsetStr}pt;`
    const topMatch = nextStyle.match(/(?:^|;)margin-top:(-?[\d.]+)pt/)
    if (topMatch) {
      const currentTopPoints = Number(topMatch[1])
      const nextTopPoints = currentTopPoints - SIGNATURE_VERTICAL_LIFT_VML_POINTS
      const nextTopStr = nextTopPoints.toFixed(2).replace(/\.?0+$/, '') || '0'
      nextStyle = nextStyle.replace(/margin-top:-?[\d.]+pt/, `margin-top:${nextTopStr}pt`)
    }
    // `mso-position-horizontal` (a keyword like "left"/"center") takes precedence over the
    // raw margin-left value in real Word — left over from the template, it silently
    // discarded the offset just set above. Strip it (and its -relative partner) so Word
    // actually uses margin-left.
    nextStyle = nextStyle
      .replace(/(?:^|;)mso-position-horizontal:[^;]*;?/, ';')
      .replace(/(?:^|;)mso-position-horizontal-relative:[^;]*;?/, ';')
      .replace(/;;+/g, ';')
    // A negative z-index is VML's "send behind text" — same occlusion problem as
    // behindDoc above. Flip it positive so the shape draws in front of the text instead.
    nextStyle = nextStyle.replace(/(?:^|;)z-index:-(\d+)/, (match, digits) => match.replace(`-${digits}`, digits))
    shape.setAttribute('style', nextStyle)
    // VML shapes fill solid white by default (`filled` defaults to true) — same as the
    // DrawingML noFill fix above, needed now that the shape is in front of the text.
    shape.setAttribute('filled', 'f')
  }

  // A sibling <w10:wrap anchorx="margin"/> left referencing the page margin (while the
  // shape itself no longer declares any margin-relative positioning, per above) is enough
  // of a mismatch that some renderers silently drop the shape instead of drawing it.
  for (const wrap of Array.from(shapeHost.getElementsByTagName('w10:wrap'))) {
    if (wrap.getAttribute('anchorx') === 'margin') {
      wrap.setAttribute('anchorx', 'text')
    }
  }

  // The recommender's textbox carries `mso-next-textbox:#_x0000_sNNNN` pointing at its OWN
  // shape id — a "continue overflow text into this other box" link left over from the
  // template that, being self-referential, is dead/broken. Word appears to render a phantom
  // linked box for it, showing up as a stray opaque white bar over the text below the
  // signature. It serves no purpose even when valid (there's no overflow text to carry), so
  // just drop it.
  for (const textbox of Array.from(shapeHost.getElementsByTagName('v:textbox'))) {
    const style = textbox.getAttribute('style') ?? ''
    const nextStyle = style
      .replace(/(?:^|;)mso-next-textbox:[^;]*;?/, ';')
      .replace(/;;+/g, ';')
      .replace(/^;/, '')
    if (nextStyle !== style) textbox.setAttribute('style', nextStyle)
  }
}

// The template's outer wrapping shape/textbox around each signature placeholder was sized
// for whatever placeholder graphic the template originally shipped with, not for the much
// smaller picture the image module actually inserts at runtime — and shrinking the picture
// itself (see getSize() above) doesn't touch this separate outer box at all. Left alone,
// that oversized, still-technically-transparent-but-bordered box is what a user actually
// selects in Word (its handles span several lines/sections, well past the small visible
// signature), and its white border stroke (fixed further down, alongside the fill) is what
// shows up as stray white lines cutting across the text it happens to cross. This shrinks
// the OUTER box down to the real picture's exact size — the inner picture's own extent
// (already correct) is left untouched via the size guards below.
function shrinkSignatureShapeToFit(doc: Document, shapeHost: Element): void {
  const targetWidthEmu = SIGNATURE_IMAGE_WIDTH_EMU
  const targetHeightEmu = SIGNATURE_IMAGE_HEIGHT_EMU
  const targetWidthPoints = SIGNATURE_IMAGE_WIDTH_POINTS
  const targetHeightPoints = SIGNATURE_IMAGE_HEIGHT_POINTS

  for (const tag of ['wp:extent', 'a:ext']) {
    for (const el of Array.from(shapeHost.getElementsByTagName(tag))) {
      const cx = Number(el.getAttribute('cx') ?? 0)
      const cy = Number(el.getAttribute('cy') ?? 0)
      if (cx > 0 && cx !== targetWidthEmu) {
        el.setAttribute('cx', String(targetWidthEmu))
      }
      if (cy > 0 && cy !== targetHeightEmu) {
        el.setAttribute('cy', String(targetHeightEmu))
      }
    }
  }

  // Both autofit mechanisms recompute the shape's rendered size from its content on the
  // fly in real Word, silently overriding the explicit size set just above — so the
  // fixed-size edit above had no visible effect until these were also disabled.
  for (const autofit of Array.from(shapeHost.getElementsByTagName('a:spAutoFit'))) {
    const noAutofit = doc.createElement('a:noAutofit')
    autofit.parentNode?.replaceChild(noAutofit, autofit)
  }

  for (const shape of Array.from(shapeHost.getElementsByTagName('v:shape'))) {
    let style = shape.getAttribute('style') ?? ''
    style = /(?:^|;)width:[^;]*/.test(style)
      ? style.replace(/width:[^;]*/, `width:${targetWidthPoints}pt`)
      : `${style}${style.endsWith(';') || style.length === 0 ? '' : ';'}width:${targetWidthPoints}pt;`
    style = /(?:^|;)height:[^;]*/.test(style)
      ? style.replace(/height:[^;]*/, `height:${targetHeightPoints}pt`)
      : `${style}${style.endsWith(';') || style.length === 0 ? '' : ';'}height:${targetHeightPoints}pt;`
    // The template's original oversized placeholder also set `mso-width-percent`/
    // `mso-height-percent` (e.g. 200) with `mso-*-relative:margin` — VML's relative-sizing
    // escape hatch, meant to override the plain `width:`/`height:` above with a percentage
    // of the page margin instead. Word ignores it once an explicit size is set (why the
    // shape looked right there), but LibreOffice's headless PDF conversion honors it,
    // reinflating the shape (here, tall enough to spill across the name and title lines
    // below) regardless of the exact-fit `height:33.75pt` just written. 0 is VML's documented
    // "disabled" value, same as this template already uses for `mso-width-percent` on some
    // of these shapes.
    style = style.replace(/mso-width-percent:[^;]*/g, 'mso-width-percent:0')
    style = style.replace(/mso-height-percent:[^;]*/g, 'mso-height-percent:0')
    shape.setAttribute('style', style)
    // VML shapes stroke solid white by default too (`stroked` defaults to true) — the
    // border was tracing the shape's full (formerly oversized) rectangle, showing up as a
    // stray white line wherever that rectangle happened to cross printed text.
    shape.setAttribute('stroked', 'f')
  }

  // Same fix as the fill above, but for the shape's own border/outline instead of its
  // interior — <a:ln> (DrawingML's line/stroke properties) had the identical opaque white
  // solidFill, tracing the (formerly oversized) rectangle's edge across the text.
  for (const shapeProperties of Array.from(shapeHost.getElementsByTagName('wps:spPr'))) {
    for (const line of Array.from(shapeProperties.getElementsByTagName('a:ln'))) {
      if (line.parentNode !== shapeProperties) continue
      for (const fill of Array.from(line.getElementsByTagName('a:solidFill'))) {
        if (fill.parentNode !== line) continue
        const noFill = doc.createElement('a:noFill')
        fill.parentNode.replaceChild(noFill, fill)
      }
    }
  }

  // Note: VML's own `mso-fit-shape-to-text` (on <v:textbox>) is deliberately left alone —
  // unlike DrawingML's <a:spAutoFit>, it doesn't override the explicit height set above in
  // practice, and stripping it once exposed a template artifact (a self-referential
  // mso-next-textbox link with nothing else in the style) that made at least one renderer
  // drop the shape's content entirely.

  // <v:textbox> reserves its own internal padding around whatever it hosts — 0.1in/0.05in
  // (7.2pt/3.6pt) left-right/top-bottom by default when no `inset` is declared, some
  // templates declare a smaller explicit one instead. Either way, that padding is carved
  // out of the shape's now-exact-fit width/height set above, leaving less room inside than
  // the picture actually needs — so the picture's own right/bottom edge (sized to the full
  // shape, not the shrunk inner area) runs past the textbox's content box and gets clipped
  // there. The shape has no visible fill/border of its own (see above), so there's nothing
  // lost by letting the picture use the whole box edge-to-edge.
  for (const textbox of Array.from(shapeHost.getElementsByTagName('v:textbox'))) {
    textbox.setAttribute('inset', '0in,0in,0in,0in')
  }

  // The preparer's signature host is a modern DrawingML text box (<wps:txbx>, inside an
  // <mc:Choice Requires="wps">, which real Word renders in preference to the legacy
  // <mc:Fallback> shape handled by the loop above) rather than the plain VML shape the
  // other three signatures use — its own padding lives on <wps:bodyPr>'s lIns/tIns/rIns/bIns
  // (EMU, not the VML inset string), same 7.2pt/3.6pt default, same clipping effect once the
  // shape is shrunk to the picture's exact size above.
  for (const bodyPr of Array.from(shapeHost.getElementsByTagName('wps:bodyPr'))) {
    for (const attr of ['lIns', 'tIns', 'rIns', 'bIns']) {
      bodyPr.setAttribute(attr, '0')
    }
  }
}

function ensureParagraphLeftIndent(doc: Document, paragraph: Element, twips: number): void {
  let pPr = Array.from(paragraph.childNodes).find((node) => node.nodeName === 'w:pPr') as Element | undefined
  if (!pPr) {
    pPr = doc.createElement('w:pPr')
    paragraph.insertBefore(pPr, paragraph.firstChild)
  }
  let ind = Array.from(pPr.childNodes).find((node) => node.nodeName === 'w:ind') as Element | undefined
  if (!ind) {
    ind = doc.createElement('w:ind')
    const propertiesAfterInd = new Set([
      'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc',
      'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl',
      'w:divId', 'w:cnfStyle', 'w:rPr', 'w:sectPr', 'w:pPrChange',
    ])
    const insertionPoint = Array.from(pPr.childNodes).find((node) => propertiesAfterInd.has(node.nodeName)) ?? null
    pPr.insertBefore(ind, insertionPoint)
  }
  ind.setAttribute('w:left', String(Math.max(0, Math.round(twips))))
}

// The preparer's signature and printed name share one paragraph in the template (the
// classic "sign over your printed name" look this org's documents use, confirmed against
// a real reference render) — so this repositions the signature shape in place rather than
// moving it to its own line; it should still visually overlap the name, just centered on
// it instead of stuck at a fixed left offset, and full-size rather than the template's
// oversized legacy placeholder box.
function repositionPreparedSignature(doc: Document): boolean {
  const body = doc.getElementsByTagName('w:body')[0]
  if (!body) return false

  const preparedParagraph = Array.from(body.childNodes).find((node) => {
    if (node.nodeName !== 'w:p' || !paragraphTextContent(node as Element).trim()) return false
    return Array.from((node as Element).getElementsByTagName('wp:extent')).some(
      (extent) => extent.getAttribute('cx') === '1525270' && extent.getAttribute('cy') === '1404620',
    )
  }) as Element | undefined
  if (!preparedParagraph) return false

  const nameText = paragraphTextContent(preparedParagraph).trim()
  // Shrink first — centering reads the shape's own declared width to compute its offset,
  // which is wrong (the template's original oversized value) until this resizes it.
  shrinkSignatureShapeToFit(doc, preparedParagraph)
  centerSignatureOverName(doc, preparedParagraph, nameText, 11, 'arial-bold')
  return true
}

// Some signature paragraphs (APPROVED:, in this template) also carry an unrelated floating
// element in a separate run — the "Verification Code" block, own-page-margin-relative
// positioning. Passing the whole paragraph to shrinkSignatureShapeToFit/centerSignatureOverName
// would let them touch that too (both iterate every matching tag they find, with no way to
// tell "the signature" from "some other floating shape that happens to share this paragraph").
// This narrows the host down to the specific <w:r> hosting the actual, plain <w:pict>/<v:shape>
// signature — identifiable by having no mc:AlternateContent ancestor, unlike the verification
// block's modern wps:wsp/wp:anchor and its own inert mc:Fallback v:shape copy. Falls back to
// the whole paragraph if no such shape is found, matching prior (pre-APPROVED:) behavior.
function findOwnSignatureShapeHost(paragraph: Element): Element {
  const ownShape = Array.from(paragraph.getElementsByTagName('v:shape'))
    .find((shape) => !hasAncestorTag(shape, 'mc:AlternateContent'))
  if (!ownShape) return paragraph

  let host: Node | null = ownShape
  while (host && host.parentNode !== paragraph) host = host.parentNode
  return (host as Element) ?? paragraph
}

function normalizeCaseStudySignaturePlaceholders(doc: Document): boolean {
  const body = doc.getElementsByTagName('w:body')[0]
  if (!body) return false

  const children = Array.from(body.childNodes)
  let changed = false
  for (const label of ['Reviewed by:', 'Recommending Approval:', 'APPROVED:']) {
    const labelParagraph = children.find((node) =>
      node.nodeName === 'w:p' && paragraphTextContent(node as Element).trim() === label,
    ) as Element | undefined
    if (!labelParagraph) continue
    changed = ensureParagraphSpacingBefore(doc, labelParagraph, '240') || changed
  }

  // The signature image and name are the two paragraphs directly after each label (no
  // conditional content sits between them here, unlike the preparer's block). Names stay
  // left-aligned; only the signature shape's own offset is recentered over that specific
  // name's estimated width. APPROVED: follows the exact same label/signature/name layout as
  // the other two in this template — but its signature paragraph also happens to carry an
  // unrelated "Verification Code" run (a separate wps:wsp/wp:anchor, own-page-margin-relative
  // positioning, meant to stay pinned to the right edge). flattenCaseStudyVerificationTextBox
  // was meant to pull that out first via a different, QR-code-specific structure that this
  // template's actual "Verification Code" block doesn't match, so it silently never fires for
  // APPROVED:, leaving its v:shape at the template's original, un-shrunk, un-centered size —
  // scoping shrink/center to just the mayor's own <w:pict>/<v:shape> run (not the whole
  // paragraph) keeps them from also touching that unrelated wp:anchor, which centerSignature
  // OverName would otherwise happily "recenter" right on top of the printed name.
  for (const label of ['Reviewed by:', 'Recommending Approval:', 'APPROVED:']) {
    const labelIndex = children.findIndex((node) =>
      node.nodeName === 'w:p' && paragraphTextContent(node as Element).trim() === label,
    )
    if (labelIndex < 0) continue

    const signatureParagraph = children[labelIndex + 1]
    const nameParagraph = children[labelIndex + 2]
    if (signatureParagraph?.nodeName === 'w:p') {
      changed = ensureParagraphMinimumLine(doc, signatureParagraph as Element, '360') || changed
      const nameText = nameParagraph?.nodeName === 'w:p' ? paragraphTextContent(nameParagraph as Element).trim() : ''
      if (nameText) {
        const signatureHost = findOwnSignatureShapeHost(signatureParagraph as Element)
        shrinkSignatureShapeToFit(doc, signatureHost)
        centerSignatureOverName(doc, signatureHost, nameText, 10)
        changed = true
      }
    }
  }

  return changed
}

function flattenCaseStudyVerificationTextBox(doc: Document): boolean {
  const body = doc.getElementsByTagName('w:body')[0]
  if (!body) return false

  let changed = false
  for (const child of Array.from(body.childNodes)) {
    if (child.nodeName !== 'w:p') continue
    const anchorParagraph = child as Element
    const textBoxes = Array.from(anchorParagraph.getElementsByTagName('wps:txbx'))
    const verificationTextBox = textBoxes.find((textBox) =>
      Array.from(textBox.getElementsByTagName('wp:extent')).some(
        (extent) => extent.getAttribute('cx') === '762000' && extent.getAttribute('cy') === '762000',
      ),
    )
    const textBoxContent = verificationTextBox?.getElementsByTagName('w:txbxContent')[0]
    if (!textBoxContent) continue

    const verificationParagraphs = Array.from(textBoxContent.childNodes)
      .filter((node) => node.nodeName === 'w:p') as Element[]
    if (verificationParagraphs.length === 0) continue

    const approvedSignatureParagraph = doc.createElement('w:p')
    for (const node of Array.from(anchorParagraph.childNodes)) {
      if (node.nodeName === 'w:pPr') continue
      const element = node as Element
      if (element.getElementsByTagName?.('wps:txbx').length) continue
      approvedSignatureParagraph.appendChild(node)
    }
    ensureParagraphMinimumLine(doc, approvedSignatureParagraph, '360')

    let cursor = anchorParagraph.nextSibling
    let approverNameParagraph: Element | null = null
    let approverTitleParagraph: Element | null = null
    let lastVisibleParagraph: Element | null = null
    const spacerParagraphs: Element[] = []
    for (let inspected = 0; cursor && inspected < 10; inspected += 1) {
      const node = cursor
      cursor = cursor.nextSibling
      if (node.nodeName !== 'w:p') break

      const paragraph = node as Element
      const text = paragraphTextContent(paragraph).trim()
      if (/^City Mayor\b/i.test(text)) {
        approverNameParagraph = lastVisibleParagraph
        approverTitleParagraph = paragraph
        break
      }
      if (text) {
        lastVisibleParagraph = paragraph
      } else {
        spacerParagraphs.push(paragraph)
      }
    }

    if (approverNameParagraph && approverTitleParagraph) {
      // The approver's signature turns out to use the same floating-shape wrapper as the
      // reviewer/recommender (not a bare inline image as originally assumed), so it gets
      // the same shape-offset centering + autofit/keyword fixes. The indent is kept as a
      // harmless fallback for a genuinely bare inline image, if that case ever occurs.
      // approvedSignatureParagraph is cloned from anchorParagraph excluding only nodes that
      // contain a <wps:txbx> — the "Verification Code: ..." text lives in one and is
      // correctly dropped, but the QR *image* itself turns out to be a separate floating
      // picture in the same paragraph, not wrapped in that txbx, so it rides along into the
      // clone. Passing the whole paragraph here let centerSignatureOverName "recenter" the
      // QR's own anchor using the signature's centering math, dragging it off the page's
      // right margin and into the printed name — same failure mode as the reviewer/
      // recommender fix above, same targeted fix: scope to just the actual signature shape.
      const approverNameText = paragraphTextContent(approverNameParagraph).trim()
      const approvedSignatureHost = findOwnSignatureShapeHost(approvedSignatureParagraph)
      shrinkSignatureShapeToFit(doc, approvedSignatureHost)
      centerSignatureOverName(doc, approvedSignatureHost, approverNameText, 10.5)
      const nameWidthPoints = estimateTextWidthPoints(approverNameText, 10.5)
      const indentPoints = Math.max(0, (nameWidthPoints - SIGNATURE_IMAGE_WIDTH_POINTS) / 2)
      ensureParagraphLeftIndent(doc, approvedSignatureParagraph, Math.round(indentPoints * 20))

      const table = doc.createElement('w:tbl')
      const tableProperties = doc.createElement('w:tblPr')
      const tableWidth = doc.createElement('w:tblW')
      tableWidth.setAttribute('w:w', '9360')
      tableWidth.setAttribute('w:type', 'dxa')
      tableProperties.appendChild(tableWidth)

      const tableBorders = doc.createElement('w:tblBorders')
      for (const edge of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
        const border = doc.createElement(`w:${edge}`)
        border.setAttribute('w:val', 'nil')
        tableBorders.appendChild(border)
      }
      tableProperties.appendChild(tableBorders)

      const tableLayout = doc.createElement('w:tblLayout')
      tableLayout.setAttribute('w:type', 'fixed')
      tableProperties.appendChild(tableLayout)
      table.appendChild(tableProperties)

      const tableGrid = doc.createElement('w:tblGrid')
      for (const width of ['4680', '4680']) {
        const column = doc.createElement('w:gridCol')
        column.setAttribute('w:w', width)
        tableGrid.appendChild(column)
      }
      table.appendChild(tableGrid)

      const row = doc.createElement('w:tr')
      const buildCell = (verticalAlignment: 'center' | 'top', topMarginTwips = '0') => {
        const cell = doc.createElement('w:tc')
        const cellProperties = doc.createElement('w:tcPr')
        const cellWidth = doc.createElement('w:tcW')
        cellWidth.setAttribute('w:w', '4680')
        cellWidth.setAttribute('w:type', 'dxa')
        cellProperties.appendChild(cellWidth)
        const cellMargins = doc.createElement('w:tcMar')
        for (const [edge, width] of [
          ['top', topMarginTwips],
          ['left', '0'],
          ['bottom', '0'],
          ['right', '0'],
        ]) {
          const margin = doc.createElement(`w:${edge}`)
          margin.setAttribute('w:w', width)
          margin.setAttribute('w:type', 'dxa')
          cellMargins.appendChild(margin)
        }
        cellProperties.appendChild(cellMargins)
        const vAlign = doc.createElement('w:vAlign')
        vAlign.setAttribute('w:val', verticalAlignment)
        cellProperties.appendChild(vAlign)
        cell.appendChild(cellProperties)
        return cell
      }

      const approverCell = buildCell('top')
      approverCell.appendChild(approvedSignatureParagraph)
      approverCell.appendChild(approverNameParagraph)
      approverCell.appendChild(approverTitleParagraph)
      row.appendChild(approverCell)

      const verificationCell = buildCell('top')
      for (const paragraph of verificationParagraphs) {
        ensureParagraphJustification(doc, paragraph, 'right')
        verificationCell.appendChild(paragraph)
      }
      row.appendChild(verificationCell)
      table.appendChild(row)

      body.insertBefore(table, anchorParagraph)
      body.removeChild(anchorParagraph)
      for (const spacer of spacerParagraphs) {
        if (spacer.parentNode === body) body.removeChild(spacer)
      }
      changed = true
      continue
    }

    const insertionPoint = anchorParagraph.nextSibling
    for (const paragraph of verificationParagraphs) {
      ensureParagraphJustification(doc, paragraph, 'right')
      body.insertBefore(paragraph, insertionPoint)
    }
    body.removeChild(anchorParagraph)
    changed = true
  }

  return changed
}

function alignCaseStudyVerificationQr(doc: Document): boolean {
  let changed = flattenCaseStudyVerificationTextBox(doc)

  for (const paragraph of Array.from(doc.getElementsByTagName('w:p'))) {
    const hasVerificationQr = Array.from(paragraph.getElementsByTagName('wp:extent')).some(
      (extent) => extent.getAttribute('cx') === '762000' && extent.getAttribute('cy') === '762000',
    )
    if (!hasVerificationQr) continue

    changed = ensureParagraphJustification(doc, paragraph, 'right') || changed
  }

  const sectionProperties = Array.from(doc.getElementsByTagName('w:sectPr')).at(-1)
  const pageSize = sectionProperties?.getElementsByTagName('w:pgSz')[0]
  const pageMargins = sectionProperties?.getElementsByTagName('w:pgMar')[0]
  const pageWidthTwips = Number(pageSize?.getAttribute('w:w'))
  const leftMarginTwips = Number(pageMargins?.getAttribute('w:left'))
  const rightMarginTwips = Number(pageMargins?.getAttribute('w:right'))
  const contentWidthPoints = (pageWidthTwips - leftMarginTwips - rightMarginTwips) / 20

  if (!Number.isFinite(contentWidthPoints) || contentWidthPoints <= 0) return changed

  for (const shape of Array.from(doc.getElementsByTagName('v:shape'))) {
    const hasVerificationQr = Array.from(shape.getElementsByTagName('wp:extent')).some(
      (extent) => extent.getAttribute('cx') === '762000' && extent.getAttribute('cy') === '762000',
    )
    if (!hasVerificationQr) continue

    const style = shape.getAttribute('style') ?? ''
    const widthMatch = style.match(/(?:^|;)width:([\d.]+)pt(?:;|$)/)
    const shapeWidthPoints = Number(widthMatch?.[1])
    if (!Number.isFinite(shapeWidthPoints) || shapeWidthPoints <= 0) continue

    // LibreOffice uses the VML fallback's explicit offset instead of its right anchor.
    const rightAlignedOffset = Math.max(0, contentWidthPoints - shapeWidthPoints)
      .toFixed(2)
      .replace(/\.?0+$/, '')
    const nextStyle = /(?:^|;)margin-left:[^;]*/.test(style)
      ? style.replace(/margin-left:[^;]*/, `margin-left:${rightAlignedOffset}pt`)
      : `${style}${style.endsWith(';') || style.length === 0 ? '' : ';'}margin-left:${rightAlignedOffset}pt;`
    if (nextStyle === style) continue

    shape.setAttribute('style', nextStyle)
    changed = true
  }

  return changed
}

function normalizeCaseStudyLayoutXml(xml: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const beneficiaryNormalized = normalizeBeneficiaryInfoParagraphs(doc)
  const deadTextBoxesRemoved = removeEmptyDecorativeTextBoxes(doc)
  const preparedSignatureRepositioned = repositionPreparedSignature(doc)
  const signatureSectionCompacted = compactCaseStudySignatureSection(doc)
  const signaturePlaceholdersNormalized = normalizeCaseStudySignaturePlaceholders(doc)
  const verificationQrAligned = alignCaseStudyVerificationQr(doc)
  const trailingParagraphsTrimmed = trimTrailingEmptyParagraphs(doc)
  const changed = beneficiaryNormalized || deadTextBoxesRemoved || preparedSignatureRepositioned || signatureSectionCompacted
    || signaturePlaceholdersNormalized
    || verificationQrAligned || trailingParagraphsTrimmed
  if (!changed) return xml

  const serialized = new XMLSerializer().serializeToString(doc)
  const xmlDeclMatch = xml.match(/^\s*<\?xml[\s\S]*?\?>/)
  return xmlDeclMatch
    ? `${xmlDeclMatch[0]}${serialized.replace(/^\s*<\?xml[\s\S]*?\?>\s*/, '')}`
    : serialized
}

function sanitizeGeneratedDocxBuffer(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer)
  let changed = false

  for (const filename of Object.keys(zip.files)) {
    if (!filename.endsWith('.xml')) continue
    const entry = zip.file(filename)
    if (!entry) continue

    const original = entry.asText()
    let cleaned = addMissingXmlNamespaces(original)
    if (filename === 'word/document.xml') {
      cleaned = normalizeCaseStudyLayoutXml(cleaned)
    }
    if (cleaned !== original) {
      zip.file(filename, cleaned)
      changed = true
    }
  }

  if (!changed) return buffer
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}

function hasAncestorTag(node: Element, tagName: string): boolean {
  let current: Node | null = node.parentNode
  while (current) {
    if (current.nodeName === tagName) return true
    current = current.parentNode
  }
  return false
}

// The reviewer/recommender/approver signature shapes are plain VML (<v:shape>, no explicit
// mso-position-horizontal-relative) — unlike the preparer's DrawingML anchor, which
// explicitly declares relativeFrom="column" and centers correctly in both renderers. Word
// resolves the same unlabeled VML shape's margin-left against the paragraph's own left edge
// (matching the centering math in centerSignatureOverName exactly — confirmed: DOCX output
// has never needed adjustment here), but LibreOffice's headless PDF conversion resolves it
// against some other, further-right reference, consistently offset by ~19.5pt regardless of
// name length or which of the three blocks it is (measured directly against the live
// container: implied name width from the written margin-left matched the real rendered name
// width almost exactly, but the shape still landed ~19.5pt right of that correct position).
// Rather than bake a Word-vs-LibreOffice fudge factor into the shared centering math (which
// would shift the DOCX left of correct to "fix" a gap that's LibreOffice-only), this nudges
// margin-left back by that fixed amount solely on the buffer fed to LibreOffice.
const PDF_SIGNATURE_HORIZONTAL_CALIBRATION_POINTS = 19.5
// Same story vertically: once the horizontal drift was fixed, the remaining ask was to nudge
// the signature up slightly further over the name (it was sitting a bit low, closer to the
// title line than the name). SIGNATURE_VERTICAL_LIFT_VML_POINTS (1pt) is the shared Word/
// LibreOffice baseline lift; this adds an extra LibreOffice-only lift on top of it.
const PDF_SIGNATURE_VERTICAL_CALIBRATION_POINTS = 8

export function adjustSignaturePositionForPdfConversion(buffer: Buffer): Buffer {
  const zip = new PizZip(buffer)
  const entry = zip.file('word/document.xml')
  if (!entry) return buffer

  const original = entry.asText()
  const parser = new DOMParser()
  const doc = parser.parseFromString(original, 'application/xml')
  let changed = false

  for (const shape of Array.from(doc.getElementsByTagName('v:shape'))) {
    const style = shape.getAttribute('style') ?? ''
    if (
      !style.includes(`width:${SIGNATURE_IMAGE_WIDTH_POINTS}pt`) ||
      !style.includes(`height:${SIGNATURE_IMAGE_HEIGHT_POINTS}pt`) ||
      hasAncestorTag(shape, 'mc:AlternateContent')
    ) continue

    let nextStyle = style
    const marginLeftMatch = style.match(/(?:^|;)margin-left:(-?[\d.]+)pt/)
    if (marginLeftMatch) {
      const nextLeft = Math.max(0, Number(marginLeftMatch[1]) - PDF_SIGNATURE_HORIZONTAL_CALIBRATION_POINTS)
      nextStyle = nextStyle.replace(/margin-left:-?[\d.]+pt/, `margin-left:${nextLeft}pt`)
    }
    const marginTopMatch = style.match(/(?:^|;)margin-top:(-?[\d.]+)pt/)
    if (marginTopMatch) {
      const nextTop = Number(marginTopMatch[1]) - PDF_SIGNATURE_VERTICAL_CALIBRATION_POINTS
      nextStyle = nextStyle.replace(/margin-top:-?[\d.]+pt/, `margin-top:${nextTop}pt`)
    }
    if (nextStyle === style) continue

    shape.setAttribute('style', nextStyle)
    changed = true
  }

  if (!changed) return buffer

  const serialized = new XMLSerializer().serializeToString(doc)
  const xmlDeclMatch = original.match(/^\s*<\?xml[\s\S]*?\?>/)
  const cleaned = xmlDeclMatch
    ? `${xmlDeclMatch[0]}${serialized.replace(/^\s*<\?xml[\s\S]*?\?>\s*/, '')}`
    : serialized

  zip.file('word/document.xml', cleaned)
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
  try {
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
  } catch (err) {
    console.warn('[removeMedicineGuaranteeLetterClause] failed:', err)
    return buffer
  }
}

function rewritePlainAicsRecommendationClause(buffer: Buffer): Buffer {
  try {
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
          .replace(clausePattern, ', through a Plain AICS, for ')
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
  } catch (err) {
    console.warn('[rewritePlainAicsRecommendationClause] failed:', err)
    return buffer
  }
}

function rewritePlainAicsPresentingProblemClause(buffer: Buffer): Buffer {
  try {
    const zip = new PizZip(buffer)
    let changed = false
    const plainProblemPattern = /seek emergency assistance for\s*(?:-|)\s*,\s*/i

    for (const filename of Object.keys(zip.files)) {
      if (!filename.startsWith('word/') || !filename.endsWith('.xml')) continue
      const entry = zip.file(filename)
      if (!entry) continue

      const original = entry.asText()
      const updated = rewriteParagraphText(original, (text) => {
        if (!text.includes('seek emergency assistance for')) return text
        return text
          .replace(plainProblemPattern, 'seek emergency assistance for ')
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
  } catch (err) {
    console.warn('[rewritePlainAicsPresentingProblemClause] failed:', err)
    return buffer
  }
}

function rewriteMedicalGuaranteeLetterSeriesClause(buffer: Buffer): Buffer {
  try {
    const zip = new PizZip(buffer)
    let changed = false
    const seriesPattern = /\bseries of\s+/i

    for (const filename of Object.keys(zip.files)) {
      if (!filename.startsWith('word/') || !filename.endsWith('.xml')) continue
      const entry = zip.file(filename)
      if (!entry) continue

      const original = entry.asText()
      const updated = rewriteParagraphText(original, (text) => {
        if (!text.includes('series of')) return text
        if (!text.includes('chargeable to Assistance to Individual in Crisis Situation Program')) return text
        return text
          .replace(seriesPattern, '')
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
  } catch (err) {
    console.warn('[rewriteMedicalGuaranteeLetterSeriesClause] failed:', err)
    return buffer
  }
}

function escapeXmlText(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatChoDoctorDisplayName(value: string): string {
  const normalized = String(value ?? '').trim()
  return normalized || 'City Health Officer'
}

function buildChoCertificationTextboxXml(caseData: any): string {
  const certData = buildChoCertData(caseData)
  const sizedTextProps = '<w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
  const boldSizedTextProps = '<w:rPr><w:b/><w:bCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
  const paragraph = (text: string, options: { bold?: boolean } = {}) => `
    <w:p>
      <w:pPr>${options.bold ? '<w:rPr><w:b/><w:bCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>' : '<w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'}</w:pPr>
      <w:r>${options.bold ? boldSizedTextProps : sizedTextProps}<w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>
    </w:p>`

  if (!certData) {
    return `<w:txbxContent><w:p/></w:txbxContent>`
  }

  const { unavailableMedicines, givenDayOrdinal, givenMonth, givenYear, choDoctorName } = certData
  const pad = [...unavailableMedicines]
  while (pad.length < 5) pad.push({ name: '', date: '', time: '' })
  const line = (index: number) => pad[index].name ? `${index + 1}. ${pad[index].name}` : ''

  return `<w:txbxContent>
    ${paragraph('CERTIFICATION', { bold: true })}
    <w:p/>
    ${paragraph(`This is to certify that the following medicine/s are not part of the regular procurement of the City Health Office: by ${formatChoDoctorDisplayName(choDoctorName)}, M.D.`)}
    <w:p/>
    ${paragraph(line(0))}
    ${paragraph(line(1))}
    ${paragraph(line(2))}
    ${paragraph(line(3))}
    ${paragraph(line(4))}
    <w:p/>
    ${paragraph(`Given this ${givenDayOrdinal} day of ${givenMonth}, ${givenYear}`)}
    <w:p/>
    <w:p/>
  </w:txbxContent>`
}

function rewriteChoCertificationTextboxTemplate(templateContent: string, caseData: any): { templateContent: string; hasTextbox: boolean } {
  try {
    const zip = new PizZip(templateContent)
    const entry = zip.file('word/document.xml')
    if (!entry) return { templateContent, hasTextbox: false }

    const original = entry.asText()
    const pattern = /<w:txbxContent>[\s\S]*?Certifification[\s\S]*?<\/w:txbxContent>/g
    const matches = original.match(pattern)
    if (!matches || matches.length === 0) {
      return { templateContent, hasTextbox: false }
    }

    const updated = original.replace(pattern, buildChoCertificationTextboxXml(caseData))
    zip.file('word/document.xml', updated)
    return {
      templateContent: zip.generate({ type: 'string', compression: 'DEFLATE' }) as string,
      hasTextbox: true,
    }
  } catch (error) {
    console.warn('[rewriteChoCertificationTextboxTemplate] failed:', error)
    return { templateContent, hasTextbox: false }
  }
}

function buildChoCertificationParagraphsXml(caseData: any): string {
  const certData = buildChoCertData(caseData)
  if (!certData) return ''

  const { unavailableMedicines, givenDayOrdinal, givenMonth, givenYear, choDoctorName } = certData
  const sizedRpr = '<w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
  const boldSizedRpr = '<w:rPr><w:b/><w:bCs/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>'
  const lines = [
    { text: 'CERTIFICATION', bold: true, center: true },
    { text: '' },
    { text: `This is to certify that the following medicine/s are not part of the regular procurement of the City Health Office: by ${formatChoDoctorDisplayName(choDoctorName)}, M.D.` },
    { text: '' },
    ...unavailableMedicines
      .filter((medicine) => medicine.name)
      .map((medicine, index) => ({ text: `${index + 1}. ${medicine.name}` })),
    { text: '' },
    { text: `Given this ${givenDayOrdinal} day of ${givenMonth}, ${givenYear}` },
  ]

  return lines.map((line) => {
    const pPr = line.center ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ''
    const rPr = line.bold ? boldSizedRpr : sizedRpr
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXmlText(line.text)}</w:t></w:r></w:p>`
  }).join('')
}

function appendChoCertificationToDocx(buffer: Buffer, caseData: any): Buffer {
  const paragraphsXml = buildChoCertificationParagraphsXml(caseData)
  if (!paragraphsXml) return buffer

  try {
    const zip = new PizZip(buffer)
    const entry = zip.file('word/document.xml')
    if (!entry) return buffer

    const original = entry.asText()
    const parser = new DOMParser()
    const doc = parser.parseFromString(original, 'application/xml')
    const body = doc.getElementsByTagName('w:body')[0]
    if (!body) return buffer

    const certificationDoc = parser.parseFromString(
      `<root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraphsXml}</root>`,
      'application/xml'
    )
    const certificationParagraphs = Array.from(certificationDoc.documentElement.childNodes)
      .filter((node) => node.nodeType === 1)
      .map((node) => node.cloneNode(true))

    if (certificationParagraphs.length === 0) return buffer

    const approvedParagraph = Array.from(doc.getElementsByTagName('w:p')).find((paragraph) => {
      const text = Array.from(paragraph.getElementsByTagName('w:t'))
        .map((node) => node.textContent ?? '')
        .join('')
        .trim()
      return text.includes('APPROVED:')
    })

    const sectPr = Array.from(body.childNodes).find((node) => node.nodeName === 'w:sectPr')
    const insertBeforeNode = approvedParagraph ?? sectPr ?? null

    for (const paragraph of certificationParagraphs) {
      body.insertBefore(paragraph, insertBeforeNode)
    }

    const serialized = new XMLSerializer().serializeToString(doc)
    const xmlDeclMatch = original.match(/^\s*<\?xml[\s\S]*?\?>/)
    const updated = xmlDeclMatch
      ? `${xmlDeclMatch[0]}${serialized.replace(/^\s*<\?xml[\s\S]*?\?>\s*/, '')}`
      : serialized
    if (updated === original) return buffer

    zip.file('word/document.xml', updated)
    return sanitizeGeneratedDocxBuffer(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer)
  } catch (error) {
    console.warn('[appendChoCertificationToDocx] failed:', error)
    return buffer
  }
}

function buildChoCertificationRenderData(caseData: any): Record<string, string> {
  const certData = buildChoCertData(caseData)
  if (!certData) {
    return {
      certificationTitle: '',
      certIntroLine: '',
      certLineOne: '',
      certLineTwo: '',
      certLineThree: '',
      certLineFour: '',
      certLineFive: '',
      certGivenLine: '',
      certNotedByLine: '',
      choDoctorNameWithMd: '',
      certPositionLine: '',
    }
  }

  const { unavailableMedicines, givenDayOrdinal, givenMonth, givenYear, choDoctorName, choPosition } = certData
  const pad = [...unavailableMedicines]
  while (pad.length < 5) pad.push({ name: '', date: '', time: '' })
  const line = (index: number) => pad[index].name ? `${index + 1}. ${pad[index].name}    :    ${pad[index].date} ${pad[index].time}` : ''

  return {
    certificationTitle: 'CERTIFICATION',
    certIntroLine: 'This is to certify that the following medicine/s are not part of the regular procurement of the City Health Office:',
    certLineOne: line(0),
    certLineTwo: line(1),
    certLineThree: line(2),
    certLineFour: line(3),
    certLineFive: line(4),
    certGivenLine: `Given this ${givenDayOrdinal} day of ${givenMonth}, ${givenYear}`,
    certNotedByLine: 'Noted by:',
    choDoctorNameWithMd: formatChoDoctorDisplayName(choDoctorName),
    certPositionLine: choPosition,
  }
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

    // 1a. Strip CHO certification paragraphs that embed broken nested-brace syntax
    //     (e.g. "{1. {ifOneMedIsNotAvail}}", "{Given this {date}day of {month},{year}}")
    //     These appear in CGV AICS Template.fixed.docx when the cert section was typed
    //     directly into the template. They cannot be parsed by docxtemplater.
    if (
      cleaned.includes('ifOneMedIsNotAvail') ||
      cleaned.includes('dateofMedicineUnavail') ||
      cleaned.includes('Certifification') ||
      cleaned.includes('choDoctorName,')
    ) {
      const CHO_TEXT_MARKERS = [
        'ifOneMedIsNotAvail', 'ifTwoMedIsNotAvail', 'ifThreeMedIsNotAvail',
        'ifFourMedIsNotAvail', 'ifFiveMedIsNotAvail',
        'dateofMedicineUnavail', 'Certifification', 'choDoctorName,',
      ]
      cleaned = cleaned
        .replace(
          /<mc:AlternateContent\b[\s\S]*?(?:ifOneMedIsNotAvail|dateofMedicineUnavail|Certifification|choDoctorName,?)[\s\S]*?<\/mc:AlternateContent>/g,
          ''
        )
        .replace(
          /<w:drawing\b[\s\S]*?(?:ifOneMedIsNotAvail|dateofMedicineUnavail|Certifification|choDoctorName,?)[\s\S]*?<\/w:drawing>/g,
          ''
        )
      cleaned = cleaned.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
        // Extract combined text of all <w:t> runs in this paragraph
        const text = (paragraph.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join('')
        if (CHO_TEXT_MARKERS.some((marker) => text.includes(marker))) return ''
        // Also strip paragraphs containing unbalanced nested braces that docxtemplater can't handle
        // Pattern: {digit. {...}} or {Given this {date}...} or {Noted by:}{...}
        if (/\{\d+\.\s*\{/.test(text) || /\{Given this \{/.test(text) || /\}\}\{Noted/.test(text) || /\{choDoctorName,\{/.test(text)) return ''
        return paragraph
      })
      if (cleaned !== original) changed = true
    }


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
  const { templateContent, hasTextbox } = rewriteChoCertificationTextboxTemplate(template, caseData)
  const rendered = removeMedicineGuaranteeLetterClause(renderDoc(templateContent, buildRenderData(caseData)))
  return hasTextbox ? rendered : appendChoCertificationToDocx(rendered, caseData)
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
  return rewriteMedicalGuaranteeLetterSeriesClause(renderDoc(template, buildRenderData(caseData)))
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
  return rewritePlainAicsPresentingProblemClause(
    rewritePlainAicsRecommendationClause(renderDoc(template, buildRenderData(caseData)))
  )
}

// ── CHO Certification for Unavailable Medicines ───────────────────────────────

function buildChoCertData(caseData: any): {
  unavailableMedicines: Array<{ name: string; date: string; time: string }>
  givenDay: string
  givenDayOrdinal: string
  givenMonth: string
  givenYear: string
  choDoctorName: string
  choPosition: string
} | null {
  const medicines: any[] = caseData.medicines ?? []

  // Filter medicines that are NOT available in the CHO catalog. Every encoded medicine is
  // linked to a MedicineItem (auto-created as unavailable if it wasn't already on file), so
  // an unlinked row only happens for legacy data saved before that link was enforced.
  const unavailable = medicines.filter((m: any) => {
    if (m.medicine == null) return false
    return m.medicine.isAvailable === false
  })

  if (unavailable.length === 0) return null

  const unavailableMedicines = unavailable.map((m: any) => {
    const rawValue = m.medicine?.unavailableUpdatedAt
      ?? m.medicine?.availabilityUpdatedAt
      ?? m.medicine?.updatedAt
      ?? null
    const raw: Date | null = rawValue ? new Date(rawValue) : null
    const date = raw
      ? raw.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })
      : '-'
    const time = raw
      ? raw.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' })
      : '-'
    return { name: m.medicineName ?? '-', date, time }
  })

  // Staff can set the date the medicine will actually be given (encoded on the case ahead of
  // pickup, which is often days after the certification is printed); fall back to today when
  // no date has been set yet. The override is a plain YYYY-MM-DD date with no time/timezone
  // component, so its parts are read directly rather than round-tripped through Date/getDate()
  // (which would follow the server's local timezone and could shift the calendar day).
  const rawGivenOverride = String((caseData as any).choCertGivenDate ?? '')
  const overrideMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawGivenOverride)

  const now = new Date()
  const givenDay = overrideMatch ? String(Number(overrideMatch[3])) : String(now.getDate())
  const givenDayOrdinal = overrideMatch ? formatOrdinalDay(Number(overrideMatch[3])) : formatOrdinalDay(now.getDate())
  const givenMonth = overrideMatch
    ? MONTH_NAMES[Number(overrideMatch[2]) - 1]
    : now.toLocaleString('en-PH', { month: 'long', timeZone: 'Asia/Manila' })
  const givenYear = overrideMatch ? overrideMatch[1] : String(now.getFullYear())

  // CHO officer info – prefer explicit CHO signer fields or the active CHO user profile
  // resolved during report serialization, then fall back to case approval data.
  const choDoctorName = fmt((caseData as any).choDoctorName
    ?? (caseData as any).officialChoDoctorName
    ?? (caseData as any).approvedByName
    ?? 'City Health Officer')
  const choPosition = fmt((caseData as any).choPosition
    ?? (caseData as any).officialChoDoctorPosition
    ?? (caseData as any).approvedByTitle
    ?? 'City Health Officer')

  return { unavailableMedicines, givenDay, givenDayOrdinal, givenMonth, givenYear, choDoctorName, choPosition }
}

/**
 * Generates a CHO Certification DOCX for medicines in a case that are NOT available
 * in the regular CHO procurement catalog. Returns null if all medicines are available.
 */
export async function generateChoCertificationDocx(caseData: any): Promise<Buffer | null> {
  const certData = buildChoCertData(caseData)
  if (!certData) return null

  const { unavailableMedicines, givenDay, givenDayOrdinal, givenMonth, givenYear, choDoctorName, choPosition } = certData

  // Pad up to 5 medicine slots (blank if fewer)
  const pad = (arr: typeof unavailableMedicines, len: number) => {
    const copy = [...arr]
    while (copy.length < len) copy.push({ name: '', date: '', time: '' })
    return copy
  }
  const meds = pad(unavailableMedicines, 5)

  const renderData: Record<string, any> = {
    Certifification: 'CERTIFICATION',
    ifOneMedIsNotAvail:   meds[0].name,
    ifTwoMedIsNotAvail:   meds[1].name,
    ifThreeMedIsNotAvail: meds[2].name,
    ifFourMedIsNotAvail:  meds[3].name,
    ifFiveMedIsNotAvail:  meds[4].name,

    date:          givenDayOrdinal,
    month:         givenMonth,
    year:          givenYear,
    choDoctorName,
    choDoctorNameWithMd: formatChoDoctorDisplayName(choDoctorName),
    MD:            'M.D.',
    position:      choPosition,
  }

  // Attempt to load a dedicated CHO cert template; fall back to a plain DOCX built in-memory
  const CHO_CERT_CANDIDATES = [
    path.join('Medicine Case Study', 'CHO Certification.fixed.docx'),
    path.join('Medicine Case Study', 'CHO Certification.docx'),
    'CHO Certification.docx',
  ]

  try {
    const template = loadFirstAvailableTemplate(CHO_CERT_CANDIDATES)
    return renderDoc(template, renderData)
  } catch {
    // No template file found — build a simple certification DOCX programmatically using docx library
    return buildChoCertDocxProgrammatic(renderData, unavailableMedicines, givenDayOrdinal, givenMonth, givenYear, choDoctorName)
  }
}

function buildChoCertDocxProgrammatic(
  _renderData: Record<string, any>,
  unavailableMedicines: Array<{ name: string; date: string; time: string }>,
  givenDayOrdinal: string,
  givenMonth: string,
  givenYear: string,
  choDoctorName: string
): Buffer {
  // Build a minimal valid DOCX from scratch using raw Open XML
  const certificationText = [
    'CERTIFICATION',
    '',
    `This is to certify that the following medicine/s are not part of the regular procurement of the City Health Office: by ${formatChoDoctorDisplayName(choDoctorName)}, M.D.`,
    '',
    ...unavailableMedicines
      .filter((m) => m.name)
      .map((m, i) => `${i + 1}. ${m.name}`),
    '',
    `Given this ${givenDayOrdinal} day of ${givenMonth}, ${givenYear}`,
  ]

  const paragraphs = certificationText
    .map((line) => {
      const bold = line === 'CERTIFICATION'
      const center = line === 'CERTIFICATION'
      const pPr = center ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : ''
      const rPr = bold ? '<w:rPr><w:b/><w:bCs/></w:rPr>' : ''
      return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r></w:p>`
    })
    .join('')

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const zip = new PizZip()
  zip.file('[Content_Types].xml', contentTypesXml)
  zip.file('_rels/.rels', rootRelsXml)
  zip.file('word/document.xml', documentXml)
  zip.file('word/styles.xml', stylesXml)
  zip.file('word/_rels/document.xml.rels', relsXml)

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}
