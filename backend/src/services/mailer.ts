import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass,
  },
})

interface MailOptions {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
}

export async function sendMail({ to, subject, html, attachments }: MailOptions) {
  if (!env.smtpHost || !env.smtpUser) {
    logger.info('Email suppressed in non-production mode', { to, subject })
    return
  }
  try {
    await transporter.sendMail({ from: env.smtpFrom, to, subject, html, attachments })
  } catch (error) {
    logger.withError('Email delivery failed', error, { to, subject })
    throw error
  }
}

function wrapEmailTemplate({
  eyebrow,
  title,
  intro,
  body,
  footer,
}: {
  eyebrow: string
  title: string
  intro: string
  body: string
  footer: string
}) {
  return `
    <div style="margin:0;padding:24px;background:#ecfdf5;font-family:Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #d1fae5;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(6,95,70,0.08)">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#065f46 0%,#059669 55%,#10b981 100%);color:#ffffff">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;opacity:0.82">${eyebrow}</p>
          <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:700">AICS Vigan City</h1>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.6;opacity:0.92">${title}</p>
        </div>
        <div style="padding:32px">
          <p style="margin:0 0 14px;color:#0f172a;font-size:15px;line-height:1.7">${intro}</p>
          ${body}
          <div style="margin-top:28px;padding-top:18px;border-top:1px solid #d1fae5">
            <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7">${footer}</p>
          </div>
        </div>
      </div>
    </div>
  `
}

function infoPanel(content: string) {
  return `
    <div style="background:#f0fdf4;border:1px solid #a7f3d0;border-left:6px solid #059669;border-radius:14px;padding:20px 22px;margin:24px 0">
      ${content}
    </div>
  `
}

export function otpEmailHtml(firstName: string, otp: string) {
  return wrapEmailTemplate({
    eyebrow: 'Online Assistance Portal',
    title: 'Account Verification',
    intro: `Hello <strong>${firstName}</strong>, use the verification code below to confirm your account. This code expires in <strong>10 minutes</strong>.`,
    body: `
      <div style="margin:28px 0;padding:22px;background:#f0fdf4;border:1px solid #86efac;border-radius:16px;text-align:center">
        <p style="margin:0 0 8px;color:#047857;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">Verification Code</p>
        <p style="margin:0;color:#065f46;font-size:38px;font-weight:800;letter-spacing:8px">${otp}</p>
      </div>
    `,
    footer: 'If you did not request this verification code, you can safely ignore this email.',
  })
}

export function statusUpdateEmailHtml(firstName: string, referenceNumber: string, status: string, message?: string) {
  const statusLabels: Record<string, string> = {
    submitted: 'Application Submitted',
    under_review: 'Under Review',
    resubmission_required: 'Resubmission Required',
    for_review: 'For Review',
    recommending_approval: 'For Recommending Approval',
    for_approval: 'For Final Approval',
    documents_required: 'Documents Required',
    scheduled: 'Interview Scheduled',
    approved: 'Approved',
    disapproved: 'Disapproved',
    released: 'Released',
  }
  const label = statusLabels[status] ?? status
  return wrapEmailTemplate({
    eyebrow: 'Online Assistance Portal',
    title: 'Application Status Update',
    intro: `Hello <strong>${firstName}</strong>, your application <strong>${referenceNumber}</strong> has a new status update.`,
    body: infoPanel(`
      <p style="margin:0;color:#065f46;font-size:18px;font-weight:700">${label}</p>
      ${message ? `<p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.7">${message}</p>` : ''}
      <p style="margin:12px 0 0;color:#334155;font-size:14px;line-height:1.7">Log in to your portal account to review the full case details.</p>
    `),
    footer: 'Case AICS - Vigan City, Ilocos Sur',
  })
}

export function approvedEmailHtml(
  firstName: string,
  referenceNumber: string,
  mode: 'office_submission' | 'final_approval' = 'office_submission',
) {
  if (mode === 'final_approval') {
    return wrapEmailTemplate({
      eyebrow: 'Online Assistance Portal',
      title: 'Final Approval Notice',
      intro: `Hello <strong>${firstName}</strong>, your application <strong>${referenceNumber}</strong> has received <strong style="color:#047857">final approval</strong> from the office.`,
      body: infoPanel(`
        <p style="margin:0;color:#065f46;font-size:14px;font-weight:700;letter-spacing:0.3px">Status Update</p>
        <p style="margin:10px 0 0;color:#1e293b;font-size:14px;line-height:1.7">Please log in to your portal account to review the latest case status and release instructions.</p>
      `),
      footer: 'Case AICS - Vigan City, Ilocos Sur',
    })
  }

  return wrapEmailTemplate({
    eyebrow: 'Online Assistance Portal',
    title: 'Application Approved',
    intro: `Hello <strong>${firstName}</strong>, your application <strong>${referenceNumber}</strong> has been <strong style="color:#047857">approved</strong>.`,
    body: `
      ${infoPanel(`
        <p style="margin:0;color:#065f46;font-size:14px;font-weight:700;letter-spacing:0.3px">Next Step</p>
        <p style="margin:10px 0 0;color:#1e293b;font-size:14px;line-height:1.7">You may come to the <strong>municipal hall admin office</strong> at any convenient time for document passing.</p>
      `)}
      <p style="margin:0;color:#475569;font-size:14px;line-height:1.7">Bring a valid government-issued ID and all supporting documents for your application.</p>
    `,
    footer: 'Case AICS - Vigan City, Ilocos Sur',
  })
}

export function guaranteeLetterEmailHtml(firstName: string, referenceNumber: string, verificationUrl: string, verificationCode: string) {
  return wrapEmailTemplate({
    eyebrow: 'Guarantee Letter Release',
    title: 'Authentic PDF Attached',
    intro: `Hello <strong>${firstName}</strong>, your guarantee letter for case <strong>${referenceNumber}</strong> is attached to this email.`,
    body: `
      ${infoPanel(`
        <p style="margin:0;color:#065f46;font-size:14px;font-weight:700;letter-spacing:0.3px">Verification</p>
        <p style="margin:10px 0 6px;color:#1e293b;font-size:14px;line-height:1.7">Verification code: <strong>${verificationCode}</strong></p>
        <p style="margin:0;font-size:14px;line-height:1.7"><a href="${verificationUrl}" style="color:#047857;text-decoration:underline;word-break:break-all">${verificationUrl}</a></p>
      `)}
      <p style="margin:0;color:#475569;font-size:14px;line-height:1.7">Scan the QR code inside the document or use the verification link above to confirm that the letter is authentic.</p>
    `,
    footer: 'Case AICS - Vigan City, Ilocos Sur',
  })
}

export function passwordResetEmailHtml(firstName: string, resetLink: string) {
  return wrapEmailTemplate({
    eyebrow: 'Password Reset Request',
    title: 'Secure Access Update',
    intro: `Hello <strong>${firstName}</strong>, click the button below to reset your password. This link expires in <strong>30 minutes</strong>.`,
    body: `
      <div style="text-align:center;margin:32px 0">
        <a href="${resetLink}" style="background:linear-gradient(135deg,#065f46 0%,#059669 55%,#10b981 100%);color:#ffffff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block;box-shadow:0 8px 20px rgba(5,150,105,0.24)">Reset Password</a>
      </div>
    `,
    footer: 'If you did not request a password reset, you can safely ignore this email.',
  })
}
