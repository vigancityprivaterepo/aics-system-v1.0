import PDFDocument from 'pdfkit'
import type { SerializedCase } from '../serializers/caseSerializer.js'
import { richTextToPlainText } from '../utils/richText.js'

type CaseReportPayload = {
  caseNumber: string
  assistanceType: string
  clientName: string
  dateOfAssessment?: string | null
  socialWorkerName?: string | null
  presentingProblem?: string | null
  backgroundOfProblem?: string | null
  assessment?: string | null
  recommendation?: string | null
  remarks?: string | null
  amount?: number | null
  verificationUrl?: string | null
  verificationCode?: string | null
  qrCodeImage?: Buffer | null
  renderableCase?: SerializedCase | null
}

type GuaranteeLetterPayload = {
  caseNumber: string
  assistanceType: string
  clientName: string
  beneficiaryName?: string | null
  proxyName?: string | null
  proxyRelationship?: string | null
  recipientName?: string | null
  recipientAddress?: string | null
  diagnosis?: string | null
  medicalType?: string | null
  lineItems?: Array<{ label: string; value: string | null | undefined }>
  amount?: number | null
  date?: string
  socialWorkerName?: string | null
  verificationUrl?: string | null
  verificationCode?: string | null
  qrCodeImage?: Buffer | null
}

function toBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

function renderDocumentAuthenticationBlock(doc: PDFKit.PDFDocument, payload: {
  verificationUrl?: string | null
  verificationCode?: string | null
  qrCodeImage?: Buffer | null
}) {
  if (!payload.qrCodeImage && !payload.verificationCode && !payload.verificationUrl) return

  const authTop = Math.max(doc.y + 16, 620)
  doc.fontSize(10).text('Document Authentication', 50, authTop, { underline: true })
  if (payload.verificationCode) {
    doc.fontSize(9).text(`Verification Code: ${payload.verificationCode}`, 50, authTop + 18)
  }
  if (payload.verificationUrl) {
    doc
      .fontSize(8)
      .fillColor('#2563eb')
      .text(payload.verificationUrl, 50, authTop + 34, {
        width: 300,
        link: payload.verificationUrl,
        underline: true,
      })
      .fillColor('black')
  }
  doc.fontSize(8).text('Scan the QR code or open the verification link to confirm authenticity.', 50, authTop + 62, {
    width: 300,
  })
  if (payload.qrCodeImage) {
    doc.image(payload.qrCodeImage, 385, authTop, { fit: [140, 140], align: 'right' })
  }
}

function caseReportContentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right
}

function caseReportContentBottom(doc: PDFKit.PDFDocument) {
  return doc.page.height - doc.page.margins.bottom - 24
}

function drawCaseReportPageChrome(doc: PDFKit.PDFDocument, payload: CaseReportPayload, pageNumber: number) {
  const left = doc.page.margins.left
  const top = doc.page.margins.top
  const width = caseReportContentWidth(doc)

  doc.save()
  doc.fillColor('#111111')
  doc.font('Helvetica-Bold').fontSize(15).text('CITY GOVERNMENT OF VIGAN', left, top - 6, {
    width,
    align: 'center',
    lineBreak: false,
  })
  doc.font('Helvetica').fontSize(10).text('AICS Case Study Report', left, top + 16, {
    width,
    align: 'center',
    lineBreak: false,
  })
  doc.font('Helvetica').fontSize(8).fillColor('#666666').text(`Page ${pageNumber}`, left, doc.page.height - 34, {
    width,
    align: 'right',
    lineBreak: false,
  })
  doc
    .strokeColor('#C7CDD4')
    .lineWidth(1)
    .moveTo(left, top + 34)
    .lineTo(left + width, top + 34)
    .stroke()
  doc.restore()

  doc.x = left
  doc.y = top + 48
}

function ensureCaseReportSpace(doc: PDFKit.PDFDocument, minHeight: number) {
  if (doc.y + minHeight <= caseReportContentBottom(doc)) return false
  doc.addPage()
  return true
}

function renderCaseMetaLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  const left = doc.page.margins.left
  const width = caseReportContentWidth(doc)
  const y = doc.y

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#111111').text(`${label}:`, left, y, {
    width: 130,
    continued: false,
    lineBreak: false,
  })
  doc.font('Helvetica').fontSize(10.5).text(value || '-', left + 132, y, {
    width: width - 132,
  })
}

function renderCaseReportSection(doc: PDFKit.PDFDocument, title: string, body: string) {
  const left = doc.page.margins.left
  const width = caseReportContentWidth(doc)
  const normalizedBody = body.trim() || '-'

  doc.font('Helvetica-Bold').fontSize(12)
  ensureCaseReportSpace(doc, 28)
  doc.fillColor('#111111').text(title, left, doc.y, {
    width,
    underline: true,
  })
  doc.moveDown(0.3)

  doc.font('Helvetica').fontSize(10.5)
  const bodyHeight = doc.heightOfString(normalizedBody, { width, align: 'justify' })
  ensureCaseReportSpace(doc, Math.min(Math.max(bodyHeight + 8, 42), 220))
  doc.text(normalizedBody, left, doc.y, {
    width,
    align: 'justify',
  })
  doc.moveDown(0.9)
}

function renderPreparedByBlock(doc: PDFKit.PDFDocument, socialWorkerName: string | null | undefined) {
  const left = doc.page.margins.left
  const lineWidth = 240
  const lineY = doc.y + 30

  ensureCaseReportSpace(doc, 110)
  doc.font('Helvetica').fontSize(10.5).fillColor('#111111').text('Prepared by:', left, doc.y)
  doc
    .strokeColor('#333333')
    .lineWidth(1)
    .moveTo(left, lineY)
    .lineTo(left + lineWidth, lineY)
    .stroke()
  doc.font('Helvetica-Bold').fontSize(10).text(socialWorkerName?.trim() || 'Social Worker', left, lineY + 6, {
    width: lineWidth,
    align: 'center',
  })
  doc.font('Helvetica').fontSize(9).fillColor('#555555').text('Social Worker', left, lineY + 22, {
    width: lineWidth,
    align: 'center',
  })
  doc.fillColor('#111111')
  doc.y = lineY + 46
}

function normalizeText(value: unknown): string {
  const normalized = richTextToPlainText(value).replace(/\s+/g, ' ').trim()
  return normalized || '-'
}

function calculateAge(dateOfBirth: string | null | undefined): string {
  if (!dateOfBirth) return '-'
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return '-'
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDelta = today.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1
  return String(Math.max(age, 0))
}

function truncateParagraph(doc: PDFKit.PDFDocument, value: string, width: number, maxHeight: number, options: PDFKit.Mixins.TextOptions = {}) {
  const normalized = normalizeText(value)
  if (doc.heightOfString(normalized, { width, ...options }) <= maxHeight) return normalized

  const words = normalized.split(/\s+/)
  let low = 1
  let high = words.length
  let best = '-'

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = `${words.slice(0, mid).join(' ')}...`
    if (doc.heightOfString(candidate, { width, ...options }) <= maxHeight) {
      best = candidate
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return best
}

function drawHeader(doc: PDFKit.PDFDocument, pageNumber: number) {
  const left = doc.page.margins.left
  const width = caseReportContentWidth(doc)
  const top = doc.page.margins.top - 8

  doc.save()
  doc.fillColor('#111111')
  doc.font('Helvetica').fontSize(8).text('Republic of the Philippines', left + 168, top + 2, { width: 180, lineBreak: false })
  doc.font('Helvetica').fontSize(8).text('Province of Ilocos Sur', left + 168, top + 11, { width: 180, lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(11).text('CITY OF VIGAN', left + 168, top + 20, { width: 180, lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(11).text('SOCIAL CASE STUDY REPORT', left, top + 44, { width, align: 'center' })
  doc.font('Helvetica-Bold').fontSize(8.5).text('AICS - Assistance to Individuals in Crisis Situation Program', left, top + 58, {
    width,
    align: 'center',
  })

  // Simple badge placeholders in lieu of embedded logo assets.
  const badgeY = top + 6
  const badges = [
    { x: left + 8, label: 'CGV' },
    { x: left + 44, label: 'IS' },
    { x: left + 80, label: 'AICS' },
  ]
  for (const badge of badges) {
    doc.circle(badge.x + 12, badgeY + 12, 12).lineWidth(1).strokeColor('#8A8FB3').stroke()
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor('#4B5563').text(badge.label, badge.x + 1, badgeY + 10, {
      width: 22,
      align: 'center',
      lineBreak: false,
    })
  }

  doc.font('Helvetica').fontSize(7).fillColor('#777777').text('*PUBLIC SERVICE ABOVE SELF*', left, doc.page.height - 36, {
    width,
    align: 'center',
  })
  doc.font('Helvetica').fontSize(6).text('Vigan City Hall, Burgos St. corner Quezon Avenue, Vigan City 2700, Philippines', left, doc.page.height - 27, {
    width,
    align: 'center',
  })
  doc.font('Helvetica').fontSize(6).text('vigancity.gov.ph • admin@vigancity.gov.ph', left, doc.page.height - 19, {
    width,
    align: 'center',
  })
  doc.font('Helvetica').fontSize(6).text(`Page ${pageNumber} of 2 AICS`, left, doc.page.height - 19, {
    width,
    align: 'right',
  })
  doc.restore()
}

function drawCheckboxText(doc: PDFKit.PDFDocument, x: number, y: number, label: string, checked: boolean, width = 110) {
  doc.font('Helvetica').fontSize(7).fillColor('#111111').text(`${checked ? '[x]' : '[ ]'} ${label}`, x, y, {
    width,
    lineBreak: false,
  })
}

function drawFieldRow(doc: PDFKit.PDFDocument, x: number, y: number, label: string, value: string, labelWidth = 120, valueWidth = 230) {
  doc.font('Helvetica').fontSize(7.5).fillColor('#111111').text(label, x, y, { width: labelWidth, lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(7.5).text(value || '-', x + labelWidth, y, { width: valueWidth })
}

function drawSectionTitle(doc: PDFKit.PDFDocument, x: number, y: number, title: string) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111').text(title, x, y, { lineBreak: false })
}

function drawTable(doc: PDFKit.PDFDocument, x: number, y: number, widths: number[], heights: number[]) {
  let currentY = y
  for (let row = 0; row < heights.length; row += 1) {
    let currentX = x
    for (let col = 0; col < widths.length; col += 1) {
      doc.rect(currentX, currentY, widths[col], heights[row]).lineWidth(0.6).strokeColor('#111111').stroke()
      currentX += widths[col]
    }
    currentY += heights[row]
  }
}

function renderFixedCaseReportPdf(payload: CaseReportPayload, renderable: SerializedCase): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 42 })
  const left = doc.page.margins.left
  const top = doc.page.margins.top + 32
  const contentWidth = caseReportContentWidth(doc)

  const client = renderable.client
  const beneficiaryName = normalizeText(renderable.beneficiaryName)
  const beneficiaryAddress = normalizeText(renderable.beneficiaryAddress)
  const age = renderable.assistanceType === 'burial'
    ? normalizeText(renderable.burialDetails?.deceasedAge)
    : normalizeText(renderable.beneficiaryAge) || calculateAge(renderable.client?.dateOfBirth ?? null)
  const sex = renderable.assistanceType === 'burial'
    ? normalizeText(renderable.burialDetails?.deceasedSex)
    : normalizeText(renderable.beneficiarySex) || normalizeText(client?.sex)
  const civilStatus = renderable.assistanceType === 'burial'
    ? normalizeText(renderable.burialDetails?.deceasedCivilStatus)
    : normalizeText(renderable.beneficiaryCivilStatus) || normalizeText(client?.civilStatus)
  const occupation = renderable.assistanceType === 'burial'
    ? normalizeText(renderable.burialDetails?.deceasedOccupation)
    : normalizeText(renderable.beneficiaryOccupation) || normalizeText(client?.occupation)
  const relationship = normalizeText(renderable.proxyRelationship)
  const contactNumber = normalizeText(client?.contactNumber)
  const religion = normalizeText(client?.religion)
  const familyRows = Array.isArray(renderable.familyComposition) ? renderable.familyComposition.slice(0, 3) : []
  const plainKinds = new Set((renderable.plainDetails?.assistanceKinds ?? []).map((item) => String(item).toLowerCase()))
  const selectedAssistance = {
    medicine: renderable.assistanceType === 'medicine',
    medical: renderable.assistanceType === 'medical' || (renderable.assistanceType === 'plain' && plainKinds.has('medical')),
    hospital: renderable.assistanceType === 'hospital' || (renderable.assistanceType === 'plain' && plainKinds.has('hospital')),
    burial: renderable.assistanceType === 'burial' || (renderable.assistanceType === 'plain' && plainKinds.has('burial')),
    eyeglass: renderable.assistanceType === 'eyeglass',
    other: renderable.assistanceType === 'plain',
  }
  const categoryText = String(client?.clientCategory ?? '').toLowerCase()
  const requirements = renderable.requirements ?? {}
  const requirementsGrid = [
    ['personal_letter', 'med_request', 'clinical_abstract', 'death_cert', 'prescription'],
    ['medical_cert', 'medical_cert', 'final_bill', 'billing_stmt', 'indigency'],
    ['prescription', 'price_quotation', 'promissory_note', 'indigency', 'id_copy'],
    ['indigency', 'indigency', 'indigency', 'id_copy', ''],
    ['id_copy', 'id_copy', 'id_copy', '', ''],
    ['cho_cert', '', '', '', ''],
  ]
  const narrativeWidth = contentWidth - 28

  drawHeader(doc, 1)
  doc.font('Helvetica-Bold').fontSize(7.5).text(`Control No.: ${payload.caseNumber}`, left, top, { lineBreak: false })
  doc.font('Helvetica-Bold').fontSize(7.5).text(`Date: ${normalizeText(renderable.dateOfAssessment)}`, left + 230, top, { lineBreak: false })

  doc.font('Helvetica-Bold').fontSize(7.5).text('Type of Assistance Requested:', left, top + 22)
  drawCheckboxText(doc, left + 110, top + 22, 'Medicine', selectedAssistance.medicine, 58)
  drawCheckboxText(doc, left + 170, top + 22, 'Medical Procedure', selectedAssistance.medical, 88)
  drawCheckboxText(doc, left + 260, top + 22, 'Hospital', selectedAssistance.hospital, 52)
  drawCheckboxText(doc, left + 315, top + 22, 'Burial', selectedAssistance.burial, 44)
  drawCheckboxText(doc, left + 362, top + 22, 'Eyeglass', selectedAssistance.eyeglass, 58)
  drawCheckboxText(doc, left + 423, top + 22, 'Other', selectedAssistance.other, 42)

  doc.font('Helvetica-Bold').fontSize(7.5).text('Category:', left, top + 40)
  drawCheckboxText(doc, left + 52, top + 40, '4Ps', categoryText.includes('4ps') || Boolean(client?.is4ps), 38)
  drawCheckboxText(doc, left + 92, top + 40, 'PWD', categoryText.includes('pwd') || Boolean(client?.isPwd), 40)
  drawCheckboxText(doc, left + 135, top + 40, 'Solo Parent', categoryText.includes('solo'), 64)
  drawCheckboxText(doc, left + 201, top + 40, 'Senior Citizen', categoryText.includes('senior') || Boolean(client?.isSenior), 72)
  drawCheckboxText(doc, left + 275, top + 40, 'Walk-in', categoryText.includes('walk'), 52)
  drawCheckboxText(doc, left + 330, top + 40, 'Referred', categoryText.includes('referred'), 56)
  drawCheckboxText(doc, left + 389, top + 40, 'Other', !categoryText || (!categoryText.includes('4ps') && !categoryText.includes('pwd') && !categoryText.includes('solo') && !categoryText.includes('senior') && !categoryText.includes('walk') && !categoryText.includes('referred')), 48)

  drawSectionTitle(doc, left, top + 66, 'I. BENEFICIARY INFORMATION')
  const infoStartY = top + 82
  drawFieldRow(doc, left + 8, infoStartY, 'Name of Beneficiary', beneficiaryName)
  drawFieldRow(doc, left + 8, infoStartY + 12, 'Address', beneficiaryAddress)
  drawFieldRow(doc, left + 8, infoStartY + 24, 'Age', `${age} years old`, 120, 120)
  drawFieldRow(doc, left + 250, infoStartY + 24, 'Sex', sex, 36, 90)
  drawFieldRow(doc, left + 8, infoStartY + 36, 'Civil Status', civilStatus, 120, 120)
  drawFieldRow(doc, left + 250, infoStartY + 36, 'Occupation', occupation, 60, 150)
  drawFieldRow(doc, left + 8, infoStartY + 48, 'Religion', religion)
  drawFieldRow(doc, left + 8, infoStartY + 60, 'Relationship Party (if not the beneficiary)', relationship, 165, 185)
  drawFieldRow(doc, left + 8, infoStartY + 72, 'Relationship to Beneficiary', relationship, 140, 170)
  drawFieldRow(doc, left + 8, infoStartY + 84, 'Contact No.', contactNumber)

  drawSectionTitle(doc, left, top + 184, 'II. FAMILY COMPOSITION')
  const familyTableX = left + 8
  const familyTableY = top + 198
  const familyWidths = [170, 52, 110, 130]
  const familyHeights = [18, 18, 18, 18]
  drawTable(doc, familyTableX, familyTableY, familyWidths, familyHeights)
  const familyHeaders = ['NAME', 'AGE', 'RELATIONSHIP', 'OCCUPATION']
  let runningX = familyTableX
  for (let index = 0; index < familyHeaders.length; index += 1) {
    doc.font('Helvetica-Bold').fontSize(7).text(familyHeaders[index], runningX + 4, familyTableY + 5, {
      width: familyWidths[index] - 8,
      align: 'left',
      lineBreak: false,
    })
    runningX += familyWidths[index]
  }
  for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
    const row = familyRows[rowIndex] ?? {}
    const rowY = familyTableY + 18 + (rowIndex * 18) + 5
    doc.font('Helvetica').fontSize(6.8)
    doc.text(truncateParagraph(doc, String((row as any).name ?? '-'), familyWidths[0] - 8, 10), familyTableX + 4, rowY, { width: familyWidths[0] - 8, lineBreak: false })
    doc.text(String((row as any).age ?? '-'), familyTableX + familyWidths[0] + 4, rowY, { width: familyWidths[1] - 8, lineBreak: false })
    doc.text(truncateParagraph(doc, String((row as any).relationship ?? '-'), familyWidths[2] - 8, 10), familyTableX + familyWidths[0] + familyWidths[1] + 4, rowY, { width: familyWidths[2] - 8, lineBreak: false })
    doc.text(truncateParagraph(doc, String((row as any).occupation ?? '-'), familyWidths[3] - 8, 10), familyTableX + familyWidths[0] + familyWidths[1] + familyWidths[2] + 4, rowY, { width: familyWidths[3] - 8, lineBreak: false })
  }
  doc.font('Helvetica-Oblique').fontSize(6).fillColor('#555555').text(
    '(Note) to prepare: list only the household members who depend upon the beneficiary. Confirm the table has not carried over from a different report.',
    familyTableX,
    familyTableY + 76,
    { width: familyWidths.reduce((sum, value) => sum + value, 0) }
  )
  doc.fillColor('#111111')

  drawSectionTitle(doc, left, top + 292, 'III. DOCUMENTARY REQUIREMENTS SUBMITTED')
  doc.font('Helvetica').fontSize(6.8).text('Tick all that apply, per the category as stated above.', left + 8, top + 304)

  const reqTableX = left + 8
  const reqTableY = top + 316
  const reqWidths = [22, 74, 74, 74, 74, 74]
  const reqHeights = [18, 28, 28, 28, 28, 28, 28]
  drawTable(doc, reqTableX, reqTableY, reqWidths, reqHeights)
  const reqHeaders = ['', 'MEDICINE', 'MEDICAL', 'HOSPITAL', 'BURIAL', 'EYEGLASS']
  runningX = reqTableX
  for (let index = 0; index < reqHeaders.length; index += 1) {
    doc.font('Helvetica-Bold').fontSize(6.6).text(reqHeaders[index], runningX + 2, reqTableY + 6, {
      width: reqWidths[index] - 4,
      align: 'center',
      lineBreak: false,
    })
    runningX += reqWidths[index]
  }
  const reqLabels = [
    ['Letter Request', 'Request Form', 'Clinical Abstract', 'Certified True Copy\nof Death Certificate', 'Medical Certificate'],
    ['Medical Certificate', 'Medical Certificate', 'Final Bill', 'Billing Statement/\nStatement of Account', 'Certificate\nof Indigency'],
    ['Prescription', 'Price Quotation', 'Promissory Note', 'Certificate of\nIndigency', 'Photocopy of ID'],
    ['Certificate of\nIndigency', 'Certificate of\nIndigency', 'Certificate of\nIndigency', 'Photocopy of ID', ''],
    ['Photocopy of ID', 'Photocopy of ID', 'Photocopy of ID', '', ''],
    ['Certificate of No\nAvailable Medicine\nas Prescribed', '', '', '', ''],
  ]
  for (let rowIndex = 0; rowIndex < reqLabels.length; rowIndex += 1) {
    const rowY = reqTableY + reqHeights.slice(0, rowIndex + 1).reduce((sum, value) => sum + value, 0) + 3
    doc.font('Helvetica').fontSize(6.2).text(String(rowIndex + 1), reqTableX + 7, rowY + 6, { width: 8, align: 'center' })
    for (let colIndex = 0; colIndex < 5; colIndex += 1) {
      const cellX = reqTableX + reqWidths.slice(0, colIndex + 1).reduce((sum, value) => sum + value, 0)
      const label = reqLabels[rowIndex][colIndex]
      const key = requirementsGrid[rowIndex][colIndex]
      const categoryKey = ['medicine', 'medical', 'hospital', 'burial', 'eyeglass'][colIndex] as keyof typeof selectedAssistance
      const checked = Boolean(key) && selectedAssistance[categoryKey] && Boolean((requirements as any)[key])
      const cellText = label ? `${checked ? '[x]' : '[ ]'} ${label}` : ''
      doc.text(cellText, cellX + 3, rowY + 3, {
        width: reqWidths[colIndex + 1] - 6,
        align: 'left',
      })
    }
  }

  doc.addPage()
  drawHeader(doc, 2)

  const pageTwoTop = doc.page.margins.top + 40
  drawSectionTitle(doc, left, pageTwoTop, 'IV. PROBLEM PRESENTED')
  doc.font('Helvetica').fontSize(8)
  const problemText = truncateParagraph(doc, normalizeText(renderable.presentingProblem), narrativeWidth, 56, { align: 'justify' })
  doc.text(problemText, left + 14, pageTwoTop + 16, { width: narrativeWidth, align: 'justify' })

  drawSectionTitle(doc, left, pageTwoTop + 78, 'V. FINDINGS')
  const findingsSource = `${normalizeText(renderable.backgroundOfProblem)} ${normalizeText(renderable.assessment)}`
  const findingsText = truncateParagraph(doc, findingsSource, narrativeWidth, 92, { align: 'justify' })
  doc.text(findingsText, left + 14, pageTwoTop + 94, { width: narrativeWidth, align: 'justify' })

  drawSectionTitle(doc, left, pageTwoTop + 188, 'VI. EVALUATION/RECOMMENDATION')
  const recommendationSource = normalizeText(renderable.recommendation)
  const recommendationText = truncateParagraph(doc, recommendationSource, narrativeWidth, 88, { align: 'justify' })
  doc.text(recommendationText, left + 14, pageTwoTop + 204, { width: narrativeWidth, align: 'justify' })

  const signaturesTop = pageTwoTop + 305
  doc.font('Helvetica').fontSize(7.6).text('Prepared and submitted by:', left, signaturesTop)
  renderPreparedByBlock(doc, renderable.socialWorkerName)
  doc.y = signaturesTop + 18
  drawFieldRow(doc, left, signaturesTop + 22, '', normalizeText(renderable.socialWorkerName), 0, 180)
  drawFieldRow(doc, left, signaturesTop + 34, '', normalizeText(renderable.preparedByPosition), 0, 180)

  doc.font('Helvetica').fontSize(7.6).text('Reviewed by:', left, signaturesTop + 60)
  drawFieldRow(doc, left, signaturesTop + 74, '', normalizeText(renderable.reviewedByName), 0, 180)
  drawFieldRow(doc, left, signaturesTop + 86, '', normalizeText(renderable.reviewedByTitle), 0, 180)

  doc.font('Helvetica').fontSize(7.6).text('Recommended approval:', left, signaturesTop + 114)
  drawFieldRow(doc, left, signaturesTop + 128, '', normalizeText(renderable.recommendingByName), 0, 180)
  drawFieldRow(doc, left, signaturesTop + 140, '', normalizeText(renderable.recommendingByTitle), 0, 180)

  doc.font('Helvetica-Bold').fontSize(7.8).text('APPROVED:', left, signaturesTop + 168)
  drawFieldRow(doc, left, signaturesTop + 182, '', normalizeText(renderable.approvedByName), 0, 180)
  drawFieldRow(doc, left, signaturesTop + 194, '', normalizeText(renderable.approvedByTitle), 0, 180)

  const authBoxX = left + 270
  const authBoxY = signaturesTop + 18
  doc.rect(authBoxX, authBoxY, 220, 170).lineWidth(0.7).strokeColor('#B8C0CC').stroke()
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111').text('Document Verification', authBoxX + 10, authBoxY + 10)
  if (payload.qrCodeImage) {
    doc.image(payload.qrCodeImage, authBoxX + 136, authBoxY + 18, { fit: [72, 72] })
  }
  doc.font('Helvetica').fontSize(7).text(`Verification Code: ${normalizeText(payload.verificationCode)}`, authBoxX + 10, authBoxY + 30, {
    width: 118,
  })
  doc.font('Helvetica').fontSize(6.8).fillColor('#2563eb').text(normalizeText(payload.verificationUrl), authBoxX + 10, authBoxY + 52, {
    width: 118,
    underline: true,
  })
  doc.fillColor('#111111')
  doc.font('Helvetica').fontSize(6.6).text(
    'Scan the QR code or open the verification link to confirm document authenticity.',
    authBoxX + 10,
    authBoxY + 86,
    { width: 198 }
  )

  return toBuffer(doc)
}

export async function generateCaseReportPdf(payload: CaseReportPayload): Promise<Buffer> {
  if (payload.renderableCase) {
    return renderFixedCaseReportPdf(payload, payload.renderableCase)
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const presentingProblem = richTextToPlainText(payload.presentingProblem) || '-'
  const backgroundOfProblem = richTextToPlainText(payload.backgroundOfProblem) || '-'
  const assessment = richTextToPlainText(payload.assessment) || '-'
  const recommendation = richTextToPlainText(payload.recommendation) || '-'
  const remarks = richTextToPlainText(payload.remarks) || '-'
  let pageNumber = 1
  doc.on('pageAdded', () => {
    pageNumber += 1
    drawCaseReportPageChrome(doc, payload, pageNumber)
  })

  drawCaseReportPageChrome(doc, payload, pageNumber)

  renderCaseMetaLine(doc, 'Case Number', payload.caseNumber)
  renderCaseMetaLine(doc, 'Assistance Type', payload.assistanceType)
  renderCaseMetaLine(doc, 'Client', payload.clientName)
  renderCaseMetaLine(doc, 'Date of Assessment', payload.dateOfAssessment ?? '-')
  renderCaseMetaLine(doc, 'Social Worker', payload.socialWorkerName ?? '-')
  doc.moveDown(1)

  renderCaseReportSection(doc, 'Presenting Problem', presentingProblem)
  renderCaseReportSection(doc, 'Background of the Problem', backgroundOfProblem)
  renderCaseReportSection(doc, 'Assessment', assessment)

  if (pageNumber === 1) {
    doc.addPage()
  } else {
    ensureCaseReportSpace(doc, 220)
  }

  renderCaseReportSection(doc, 'Recommendation', recommendation)
  renderCaseReportSection(doc, 'Remarks', remarks)

  ensureCaseReportSpace(doc, 150)
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text(`Amount: PHP ${(payload.amount ?? 0).toFixed(2)}`)
  doc.moveDown(1)
  renderPreparedByBlock(doc, payload.socialWorkerName)
  renderDocumentAuthenticationBlock(doc, payload)

  return toBuffer(doc)
}

export async function generateGuaranteeLetterPdf(payload: GuaranteeLetterPayload): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.fontSize(16).text('Department of Social Welfare and Development', { align: 'center' })
  doc.fontSize(14).text('Guarantee Letter', { align: 'center' })
  doc.moveDown(2)

  doc.fontSize(11).text(`Date: ${payload.date ?? new Date().toISOString().slice(0, 10)}`)
  doc.moveDown()
  doc.text(`To: ${payload.recipientName ?? '[Service Provider]'}`)
  if (payload.recipientAddress) {
    doc.text(payload.recipientAddress)
  }
  doc.moveDown()
  doc.text(`Assistance Type: ${payload.assistanceType}`)
  doc.moveDown()

  doc.text('This is to certify that payment support under the AICS program is being guaranteed for the case below:')
  doc.moveDown(0.5)
  doc.text(`Beneficiary: ${payload.beneficiaryName ?? payload.clientName}`)
  doc.text(`Client / Requestor: ${payload.proxyName ?? payload.clientName}`)
  doc.text(`Relationship to Beneficiary: ${payload.proxyRelationship ?? '-'}`)
  doc.text(`Case Number: ${payload.caseNumber}`)
  doc.text(`Guaranteed Amount: PHP ${(payload.amount ?? 0).toFixed(2)}`)
  if (payload.diagnosis) doc.text(`Diagnosis / Reason: ${payload.diagnosis}`)
  if (payload.medicalType) doc.text(`Medical Support Type: ${payload.medicalType}`)
  for (const item of payload.lineItems ?? []) {
    doc.text(`${item.label}: ${item.value ?? '-'}`)
  }
  doc.moveDown(2)

  doc.text('Prepared by:')
  doc.moveDown(2)
  doc.text(payload.socialWorkerName ?? 'Social Worker', { underline: true })
  doc.text('Social Worker')

  renderDocumentAuthenticationBlock(doc, payload)

  return toBuffer(doc)
}
