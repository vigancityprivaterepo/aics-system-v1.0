import { guaranteeLetterEmailHtml, sendMail } from './mailer.js'
import {
  buildGuaranteeLetterAssets,
  generateGuaranteeLetterPdfForCaseWithAssets,
  loadGuaranteeLetterCase,
} from './guaranteeLetterService.js'

export async function sendGuaranteeLetterToApplicant(input: {
  caseId: string
  email: string
  firstName: string
  referenceNumber: string
}) {
  const caseData = await loadGuaranteeLetterCase(input.caseId)
  if (!['burial', 'hospital', 'medical'].includes(caseData.assistanceType)) {
    return
  }

  const assets = await buildGuaranteeLetterAssets(caseData)
  const pdfBuffer = await generateGuaranteeLetterPdfForCaseWithAssets(caseData, assets)
  const filename = `${caseData.caseNumber ?? caseData.client.caseNumber}-guarantee-letter.pdf`

  await sendMail({
    to: input.email,
    subject: `AICS Guarantee Letter: ${input.referenceNumber}`,
    html: guaranteeLetterEmailHtml(input.firstName, input.referenceNumber, assets.verificationUrl, assets.verificationCode),
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })
}
