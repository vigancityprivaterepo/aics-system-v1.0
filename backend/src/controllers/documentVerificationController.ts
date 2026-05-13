import type { Request, Response } from 'express'
import { findCaseWithDetails } from '../queries/caseQueries.js'
import { generateDocumentVerificationCode, verifyDocumentToken } from '../services/documentVerification.js'
import { currencyFromDb } from '../utils/currency.js'

export async function verifyGuaranteeLetterDocument(req: Request, res: Response) {
  const token = String(req.params.token ?? req.query.token ?? '').trim()
  const verification = verifyDocumentToken(token)
  const caseData = await findCaseWithDetails(verification.caseId)
  if (!caseData) {
    return res.status(404).json({ valid: false, kind: verification.kind, message: 'The referenced case record was not found.' })
  }

  const currentCaseNumber = caseData.caseNumber ?? caseData.client.caseNumber
  const expectedCode = generateDocumentVerificationCode({
    kind: verification.kind,
    caseId: caseData.id,
    caseNumber: currentCaseNumber,
    assistanceType: caseData.assistanceType,
  })
  const metadataMatches =
    verification.verificationCode === expectedCode &&
    (!verification.assistanceType || caseData.assistanceType === verification.assistanceType) &&
    (!verification.caseNumber || currentCaseNumber === verification.caseNumber)

  res.json({
    valid: verification.valid && metadataMatches,
    kind: verification.kind,
    verificationCode: verification.verificationCode,
    issuedAt: verification.issuedAt,
    case: {
      id: caseData.id,
      caseNumber: currentCaseNumber,
      assistanceType: caseData.assistanceType,
      status: caseData.status,
      amount: currencyFromDb(caseData.amount),
      clientName: [caseData.client.firstName, caseData.client.middleName, caseData.client.lastName].filter(Boolean).join(' '),
    },
    message: metadataMatches
      ? `This ${verification.kind} matches an existing case record.`
      : `This token is valid but does not match the current ${verification.kind} record.`,
  })
}
