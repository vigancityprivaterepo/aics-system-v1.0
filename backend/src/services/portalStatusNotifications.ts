import { sendMail, statusUpdateEmailHtml, approvedEmailHtml, guaranteeLetterEmailHtml } from './mailer.js'
import { sendSms } from './sms.js'
import { env } from '../config/env.js'
import { prisma } from '../utils/prisma.js'
import { logger } from '../utils/logger.js'
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

  const shouldSendSms = applicant.mobileNumber && status === 'approved' && hasLinkedCase
  if (shouldSendSms) {
    jobs.push(sendSms(
      applicant.mobileNumber!,
      `AICS Vigan: Your application ${referenceNumber} is READY FOR RELEASE. Log in to the portal for the latest case update.`,
    ))
  }

  if (jobs.length === 0) return

  const results = await Promise.allSettled(jobs)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Portal Status Notification]', result.reason)
    }
  }
}

// Philippine mobile numbers only (09XXXXXXXXX / 639XXXXXXXXX / +639XXXXXXXXX);
// client contact numbers are free text and can hold landlines or notes.
function toMobileNumber(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (/^09\d{9}$/.test(digits)) return digits
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  if (/^9\d{9}$/.test(digits)) return `0${digits}`
  return null
}

// Walk-in clients have no portal account, so the "ready for release" text goes
// to the contact number on their client profile instead. Callers skip this when
// the portal applicant was already texted for the same case.
export async function sendClientReadyForReleaseSms(caseId: string) {
  const caseRow = await prisma.case.findUnique({
    where: { id: caseId },
    select: { caseNumber: true, client: { select: { contactNumber: true } } },
  })
  const mobileNumber = toMobileNumber(caseRow?.client?.contactNumber)
  if (!caseRow || !mobileNumber) {
    logger.info('Ready-for-release SMS skipped: client has no valid mobile number', { caseId })
    return
  }
  await sendSms(
    mobileNumber,
    // Keep under 160 characters with the case number so it costs one SMS credit.
    `AICS Vigan: Ti request u a tulong ${caseRow.caseNumber ?? ''} ket APPROVED ken READY FOR RELEASE. Mabalin u nga umay i claim dituy Mayor's Office, 2nd floor City Hall.`.replace(/\s+/g, ' ').trim(),
  )
}
