import PDFDocument from 'pdfkit'

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

export async function generateCaseReportPdf(payload: CaseReportPayload): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.fontSize(16).text('DSWD - AICS Case Study Report', { align: 'center' })
  doc.moveDown()

  doc.fontSize(11)
  doc.text(`Case Number: ${payload.caseNumber}`)
  doc.text(`Assistance Type: ${payload.assistanceType}`)
  doc.text(`Client: ${payload.clientName}`)
  doc.text(`Date of Assessment: ${payload.dateOfAssessment ?? '-'}`)
  doc.text(`Social Worker: ${payload.socialWorkerName ?? '-'}`)
  doc.moveDown()

  doc.fontSize(12).text('Presenting Problem', { underline: true })
  doc.fontSize(10).text(payload.presentingProblem ?? '-')
  doc.moveDown()

  doc.fontSize(12).text('Background of the Problem', { underline: true })
  doc.fontSize(10).text(payload.backgroundOfProblem ?? '-')
  doc.moveDown()

  doc.fontSize(12).text('Assessment', { underline: true })
  doc.fontSize(10).text(payload.assessment ?? '-')
  doc.moveDown()

  doc.fontSize(12).text('Recommendation', { underline: true })
  doc.fontSize(10).text(payload.recommendation ?? '-')
  doc.moveDown()

  doc.fontSize(12).text('Remarks', { underline: true })
  doc.fontSize(10).text(payload.remarks ?? '-')
  doc.moveDown()

  doc.fontSize(11).text(`Amount: PHP ${(payload.amount ?? 0).toFixed(2)}`)
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
