import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const SEMAPHORE_URL = 'https://api.semaphore.co/api/v4/messages'

export async function sendSms(to: string, message: string) {
  if (!env.semaphoreApiKey) {
    logger.info('SMS suppressed in non-production mode', { to })
    return
  }
  const body = new URLSearchParams({
    apikey: env.semaphoreApiKey,
    number: to.replace(/\D/g, ''),
    message,
    sendername: env.semaphoreSenderId,
  })
  const res = await fetch(SEMAPHORE_URL, { method: 'POST', body })
  if (!res.ok) {
    const responseBody = await res.text().catch(() => '')
    logger.error('Semaphore SMS delivery failed', {
      to,
      status: res.status,
      responseBody,
    })
    throw new Error(`Semaphore SMS delivery failed with status ${res.status}`)
  }
}

export function otpSmsMessage(otp: string) {
  return `Your AICS Vigan City verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`
}

export function statusSmsMessage(referenceNumber: string, status: string) {
  const labels: Record<string, string> = {
    submitted: 'submitted and is being processed',
    under_review: 'now under review',
    resubmission_required: 'requires resubmission due to missing or incomplete documents',
    for_review: 'now for review',
    recommending_approval: 'now for recommending approval',
    for_approval: 'now for final approval',
    documents_required: 'pending additional documents',
    scheduled: 'scheduled for interview',
    approved: 'APPROVED',
    disapproved: 'disapproved',
    released: 'released',
  }
  const label = labels[status] ?? status
  return `AICS Vigan: Your application ${referenceNumber} is ${label}. Log in to portal for details.`
}
