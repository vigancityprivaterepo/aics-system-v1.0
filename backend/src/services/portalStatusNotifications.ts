import { sendMail, statusUpdateEmailHtml, approvedEmailHtml, guaranteeLetterEmailHtml } from './mailer.js'
import { sendSms, statusSmsMessage } from './sms.js'
import { env } from '../config/env.js'
import {
  buildGuaranteeLetterAssets,
  generateGuaranteeLetterPdfForCaseWithAssets,
  loadGuaranteeLetterCase,
} from './guaranteeLetterService.js'

type ApplicantLike = {
  firstName?: string | null
  email?: string | null
  mobileNumber?: string | null
}

type ApplicationLike = {
  referenceNumber?: string | null
  status?: string | null
  adminNotes?: string | null
  caseId?: string | null
  applicant?: ApplicantLike | null
  linkedCase?: { id?: string | null } | null
  case?: { id?: string | null } | null
}

export async function sendPortalStatusNotifications(application: ApplicationLike) {
  const applicant = application.applicant
  if (!applicant) return

  const referenceNumber = application.referenceNumber || 'your application'
  const status = application.status || 'updated'
  const notes = application.adminNotes || undefined
  const hasLinkedCase = !!(application.caseId || application.linkedCase?.id || application.case?.id)
  const shouldSendEmailForStatus = status === 'resubmission_required' || env.portalEmailNotificationStatuses.includes(status)
  const jobs: Promise<unknown>[] = []

  if (applicant.email && shouldSendEmailForStatus) {
    const isApproved = status === 'approved'
    jobs.push((async () => {
      if (isApproved && application.caseId) {
        try {
          const caseData = await loadGuaranteeLetterCase(application.caseId)
          if (['burial', 'hospital', 'medical'].includes(caseData.assistanceType)) {
            const assets = await buildGuaranteeLetterAssets(caseData)
            const pdfBuffer = await generateGuaranteeLetterPdfForCaseWithAssets(caseData, assets)
            await sendMail({
              to: applicant.email!,
              subject: `AICS Guarantee Letter: ${referenceNumber}`,
              html: guaranteeLetterEmailHtml(applicant.firstName || 'Applicant', referenceNumber, assets.verificationUrl, assets.verificationCode),
              attachments: [
                {
                  filename: `${caseData.caseNumber ?? caseData.client.caseNumber}-guarantee-letter.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                },
              ],
            })
            return
          }
        } catch (error) {
          console.error('[Guarantee Letter Email]', error)
        }
      }

      await sendMail({
        to: applicant.email!,
        subject: isApproved
          ? hasLinkedCase
            ? `AICS Application Final Approval: ${referenceNumber}`
            : `AICS Application Approved: ${referenceNumber}`
          : `AICS Application Update: ${referenceNumber}`,
        html: isApproved
          ? approvedEmailHtml(applicant.firstName || 'Applicant', referenceNumber, hasLinkedCase ? 'final_approval' : 'office_submission')
          : statusUpdateEmailHtml(applicant.firstName || 'Applicant', referenceNumber, status, notes),
      })
    })())
  }

  if (applicant.mobileNumber) {
    const msg = status === 'approved'
      ? hasLinkedCase
        ? `AICS Vigan: Your application ${referenceNumber} is APPROVED by the office. Log in to the portal for the latest case update.`
        : `AICS Vigan: Your application ${referenceNumber} is APPROVED. You may come to the municipal hall admin office at any convenient time for document passing and case creation`
      : statusSmsMessage(referenceNumber, status)
    jobs.push(sendSms(applicant.mobileNumber, msg))
  }

  if (jobs.length === 0) return

  const results = await Promise.allSettled(jobs)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Portal Status Notification]', result.reason)
    }
  }
}
