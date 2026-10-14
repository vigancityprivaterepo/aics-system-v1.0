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

  // No SMS here: approval is not yet "ready to claim". The ready-for-release
  // text is sent by sendReadyForReleaseSms when a case maker marks the case.

  if (jobs.length === 0) return

  const results = await Promise.allSettled(jobs)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[Portal Status Notification]', result.reason)
    }
  }
}

// Philippine mobile numbers only (09XXXXXXXXX / 639XXXXXXXXX / +639XXXXXXXXX);
// contact numbers are free text and can hold landlines or notes.
function toMobileNumber(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (/^09\d{9}$/.test(digits)) return digits
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`
  if (/^9\d{9}$/.test(digits)) return `0${digits}`
  return null
}

export type ReadyForReleaseSmsResult = 'sent' | 'old_case' | 'no_mobile_number' | 'not_configured' | 'failed'

// Texts the person who filed the case that it can now be claimed. Called when a
// case maker marks the case ready for release, never on approval itself. Portal
// applicants are texted on their account number; walk-in clients on the contact
// number in their client profile. Never throws: the result is reported back to
// the staff member who marked the case.
export async function sendReadyForReleaseSms(caseId: string): Promise<ReadyForReleaseSmsResult> {
  try {
    const caseRow = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        caseNumber: true,
        createdAt: true,
        client: { select: { contactNumber: true } },
        applicantApplication: { select: { applicant: { select: { mobileNumber: true } } } },
      },
    })
    if (!caseRow) return 'failed'
    // Cases created before SMS_RELEASE_NOTICE_CASES_FROM are backlog: marking
    // them must not spend SMS credits.
    if (caseRow.createdAt.getTime() < env.smsReleaseNoticeCasesFrom.getTime()) return 'old_case'

    const mobileNumber = toMobileNumber(caseRow.applicantApplication?.applicant?.mobileNumber)
      ?? toMobileNumber(caseRow.client?.contactNumber)
    if (!mobileNumber) return 'no_mobile_number'
    if (!env.semaphoreApiKey) return 'not_configured'

    await sendSms(
      mobileNumber,
      // Keep under 160 characters with the case number so it costs one SMS credit.
      `AICS Vigan: Ti request u a tulong ${caseRow.caseNumber ?? ''} ket APPROVED ken READY FOR RELEASE. Mabalin u nga umay i claim dituy Mayor's Office, 2nd floor City Hall.`.replace(/\s+/g, ' ').trim(),
    )
    return 'sent'
  } catch (error) {
    logger.error('Ready-for-release SMS failed', { caseId, error: error instanceof Error ? error.message : String(error) })
    return 'failed'
  }
}
