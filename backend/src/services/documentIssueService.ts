import crypto from 'node:crypto'
import { IssuedDocumentKind } from '@prisma/client'
import { env } from '../config/env.js'
import { currencyFromDb } from '../utils/currency.js'

function verificationCodeForIssue(input: {
  kind: IssuedDocumentKind
  issueId: string
  caseId: string
  caseNumber: string
  assistanceType: string
  issuedAtIso: string
}) {
  return crypto
    .createHmac('sha256', env.documentVerifySecret)
    .update(`${input.kind}|${input.issueId}|${input.caseId}|${input.caseNumber}|${input.assistanceType}|${input.issuedAtIso}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()
}

function fullName(caseData: any) {
  return [caseData.client?.firstName, caseData.client?.middleName, caseData.client?.lastName].filter(Boolean).join(' ').trim()
}

function beneficiaryName(caseData: any) {
  if (caseData.assistanceType === 'burial') {
    return String(caseData.burialDetails?.deceasedName ?? '').trim() || fullName(caseData)
  }
  if (caseData.assistanceType === 'hospital') {
    return String(caseData.hospitalDetails?.patientName ?? '').trim() || fullName(caseData)
  }
  return fullName(caseData)
}

export async function issueDocumentVerification(db: any, input: {
  caseData: any
  kind: IssuedDocumentKind
}) {
  const issuedAt = new Date()
  const caseNumber = input.caseData.caseNumber ?? input.caseData.client.caseNumber
  const issue = await db.documentVerificationIssue.create({
    data: {
      caseId: input.caseData.id,
      kind: input.kind,
      verificationCode: 'PENDING',
      issuedCaseNumber: caseNumber,
      issuedAssistanceType: input.caseData.assistanceType,
      issuedStatus: input.caseData.status,
      issuedAmount: currencyFromDb(input.caseData.amount),
      issuedClientName: fullName(input.caseData),
      issuedBeneficiaryName: beneficiaryName(input.caseData) || null,
      issuedAt,
      metadata: {
        socialWorkerName: input.caseData.socialWorkerName ?? null,
      },
    },
  })

  const verificationCode = verificationCodeForIssue({
    kind: input.kind,
    issueId: issue.id,
    caseId: input.caseData.id,
    caseNumber,
    assistanceType: input.caseData.assistanceType,
    issuedAtIso: issue.issuedAt.toISOString(),
  })

  await db.documentVerificationIssue.update({
    where: { id: issue.id },
    data: { verificationCode },
  })

  return {
    issueId: issue.id,
    verificationCode,
    issuedAt: issue.issuedAt,
    caseNumber,
  }
}

export function expectedVerificationCodeForIssue(issue: {
  id: string
  kind: IssuedDocumentKind
  caseId: string
  issuedCaseNumber: string
  issuedAssistanceType: string
  issuedAt: Date
}) {
  return verificationCodeForIssue({
    kind: issue.kind,
    issueId: issue.id,
    caseId: issue.caseId,
    caseNumber: issue.issuedCaseNumber,
    assistanceType: issue.issuedAssistanceType,
    issuedAtIso: issue.issuedAt.toISOString(),
  })
}
