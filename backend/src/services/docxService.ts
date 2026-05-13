import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ImageModule = require('../../vendor/docxtemplater-image-module-safe/index.cjs')
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', 'templates')

const CASE_STUDY_CANDIDATES = [
  path.join('Burial Case Study and GL', 'Burial Case Study.fixed.docx'),
]

const GL_CANDIDATES = [
  path.join('Burial Case Study and GL', 'Burial Case Study-Guarantee Letter.fixed.docx'),
  'Burial Case Study and GL.fixed.docx',
  'Burial Case Study and GL.docx',
]

const HOSPITAL_PERSONAL_CANDIDATES = [
  path.join('Hospital Case Study and GL', 'Hospital Case Study-PersonalCame.fixed.docx'),
]

const HOSPITAL_PROXY_CANDIDATES = [
  path.join('Hospital Case Study and GL', 'Hospital Case Study-Proxy.fixed.docx'),
]

const HOSPITAL_GL_CANDIDATES = [
  path.join('Hospital Case Study and GL', 'Hospital Case Study-Guarantee Letter.fixed.docx'),
  'Hospital GL.docx',
]

const MEDICINE_PERSONAL_CANDIDATES = [
  path.join('Medicine Case Study', 'Medicine Case Study-Personal.fixed.docx'),
  path.join('Medicine Case Study', 'Medicine Case Study.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine Case Study.fixed.docx'),
]

const MEDICINE_PROXY_CANDIDATES = [
  path.join('Medicine Case Study', 'Medicine Case Study-Proxy.fixed.docx'),
  path.join('Medicine Case Study', 'Medicine Case Study Proxy.fixed.docx'),
  path.join('Medicine Case Study', 'Medicine Case Study-proxy.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine Case Study-Proxy.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine Case Study Proxy.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine Case Study-proxy.fixed.docx'),
]

const MEDICINE_GL_CANDIDATES: string[] = [
  path.join('Medicine Case Study', 'Medicine Guarantee Letter.fixed.docx'),
  path.join('Medicine Case Study', 'Medicine GL.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine Guarantee Letter.fixed.docx'),
  path.join('Medicine Case Study and GL', 'Medicine GL.fixed.docx'),
]

const MEDICAL_PERSONAL_CANDIDATES = [
  path.join('Medical Case Study and GL', 'Medical Case Study-personal.fixed.docx'),
]

const MEDICAL_PROXY_CANDIDATES = [
  path.join('Medical Case Study and GL', 'Medical Case Study-proxy.fixed.docx'),
]

const MEDICAL_GL_CANDIDATES = [
  path.join('Medical Case Study and GL', 'Medical GL.fixed.docx'),
  'Medical GL.docx',
]

const EYEGLASS_PERSONAL_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'Eyeglass case.fixed.docx'),
]

const EYEGLASS_PROXY_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'Eyeglass case-proxy.fixed.docx'),
]

const EYEGLASS_ENDORSEMENT_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'Eyeglass-Endorsement.fixed.docx'),
]

const EYEGLASS_ACKNOWLEDGEMENT_CANDIDATES = [
  path.join('Eyeglass Case Study and GL', 'eyeglass-acknowledgement.fixed.docx'),
]

const PLAIN_CASE_STUDY_CANDIDATES = [
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
  const normalized = String(value).trim()
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
    const normalized = String(value).trim()
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
  const address    = [c.barangay, c.municipality, c.province, c.region].filter(Boolean).join(', ') || '-'
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
  const allowSelfRelationship =
    !((caseData.assistanceType === 'hospital' && hospital.templateType === 'proxy')
      || (caseData.assistanceType === 'medicine' && medicineTemplateType === 'proxy')
      || (caseData.assistanceType === 'medical' && medicalTemplateType === 'proxy')
      || (caseData.assistanceType === 'eyeglass' && eyeglassTemplateType === 'proxy'))
  const resolvedConformeName = fmt(
    textOrNull((eyeglass as any).conformeName)
    ?? textOrNull((medicine as any).conformeName)
    ?? textOrNull(hospital.conformeName)
    ?? textOrNull(medical.conformeName)
    ?? textOrNull(burial.conformeName)
    ?? textOrNull(hospital.patientName)
    ?? textOrNull(fullName)
  )
  const resolvedRelationship = fmt(
    textOrNull((eyeglass as any).conformeRelationship)
    ?? textOrNull((medicine as any).conformeRelationship)
    ?? textOrNull(hospital.conformeRelationship)
    ?? textOrNull(medical.conformeRelationship)
    ?? textOrNull(burial.conformeRelationship)
    ?? (allowSelfRelationship ? 'Self' : null)
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
  const reviewedByName = fmt(textOrNull((caseData as any).reviewedByName))
  const reviewedByTitle = fmt(textOrNull((caseData as any).reviewedByTitle) ?? 'Social Welfare Officer II')
  const reviewedByDate = formatLongDate((caseData as any).reviewedByDate)
  const reviewedBySignature = textOrNull((caseData as any).reviewedBySignature)

  const recommendingByName = fmt(textOrNull((caseData as any).recommendingByName))
  const recommendingByTitle = fmt(textOrNull((caseData as any).recommendingByTitle) ?? "City Social Welfare and Dev’t. Officer")
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
  // Preparer (social worker) signature and position — always available from their profile
  const preparedByPosition  = fmt(textOrNull((caseData as any).preparedByPosition))
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

    // Client
    clientName:          resolvedBeneficiaryNameList,
    fullName:            resolvedBeneficiaryName,
    beneficiaryName:     resolvedBeneficiaryName,
    beneficiaryAddress:  resolvedBeneficiaryAddress,
    proxyName:           resolvedProxyName,
    proxyClientName:     resolvedProxyNameList,
    proxyRelationship:   resolvedRelationship,
    requestorName:       resolvedProxyName,
    requestorClientName: resolvedProxyNameList,
    address:             resolvedAddress,
    age:                 caseData.assistanceType === 'burial' ? resolvedDeceasedAge : calcAge(c.dateOfBirth),
    dateOfBirth:         caseData.assistanceType === 'burial' ? '-' : fmt(c.dateOfBirth),
    occupation:          caseData.assistanceType === 'burial' ? resolvedDeceasedOccupation : fmt(c.occupation),
    religion:            fmt((c as any).religion),
    civilStatus:         caseData.assistanceType === 'burial' ? resolvedDeceasedCivilStatus : fmt(c.civilStatus),
    sex:                 caseData.assistanceType === 'burial' ? resolvedDeceasedSex : fmt(c.sex),
    contactNumber:       fmt(c.contactNumber),
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
    natureOfAssistance:  resolvedNatureOfAssistance,
    recommendation:      fmt(caseData.recommendation),
    remarks:             fmt(caseData.remarks),
    medType:             resolvedMedType,
    sufferingType:       resolvedSufferingType,

    // Social worker
    socialWorkerName:    fmt(caseData.socialWorkerName),
    Employee:            fmt(caseData.socialWorkerName),

    // Financials
    amount:              Number(amount).toFixed(2),
    amountWords:         amountToWords(Number(amount)),
    cash:                `${amountToWords(Number(amount))} (P${Number(amount).toFixed(2)})`,

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
    funeralhomeOwner:    fmt(burial.funeralHomeOwner),
    funeralownerAddress: fmt(burial.funeralOwnerAddress),
    funeralHomeOwner:    fmt(burial.funeralHomeOwner),
    funeralOwnerAddress: fmt(burial.funeralOwnerAddress),
    typeOfBill:          resolvedTypeOfBill,
    intermentDate:       resolvedIntermentDate,
    dateOfInterment:     resolvedIntermentDate,
    interredDate:        resolvedIntermentDate,
    intermitentPlace:    fmt(burial.intermentPlace),
    intermentPlace:      fmt(burial.intermentPlace),
    ConformeName:        resolvedConformeName,
    relationship:        resolvedRelationship,
    glDate:              new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),

    // Hospital fields
    patientName:         resolvedPatientName,
    hospitalName:        resolvedHospitalName,
    hospital:            resolvedHospitalName,
    hospitalAddress:     resolvedHospitalAddress,
    doctorName:          resolvedDoctorName,
    mdPosition:          resolvedMdPosition,
    admissionDate:       resolvedAdmissionDate,
    dateAdmitted:        resolvedAdmissionDate,
    diagnosis:           resolvedDiagnosis,
    diagnoseType:        resolvedDiagnosis,
    hospitalizationType: resolvedHospitalizationType,
    hospitallBill:       resolvedHospitalBill,
    hospitalBill:        resolvedHospitalBill,

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
    conformeRelationship: resolvedRelationship,
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
    casestudyMaker:      preparedBySignature,
    preparedBySignature,

    // Approval hierarchy fields
    reviewedByName,
    reviewedBy:          reviewedByName,
    reviewedByTitle,
    reviewedByPosition:  reviewedByTitle,
    reviewedByDate,
    reviewedBySignature,

    recommendingByName,
    recommendingBy:        recommendingByName,
    recommendingByTitle,
    recommendingByPosition: recommendingByTitle,
    recommendingByDate,
    recommendingBySignature,

    approvedByName,
    approvedBy:          approvedByName,
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
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
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
    let cleaned = original.replace(/<w:proofErr[^>]*\/>/g, '')

    // 1b. Normalize space-padded single-run tag names: { clientName } → {clientName}
    //     Also handles loop tags: {# familyComposition} → {#familyComposition}
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
  return renderDoc(template, buildRenderData(caseData))
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
