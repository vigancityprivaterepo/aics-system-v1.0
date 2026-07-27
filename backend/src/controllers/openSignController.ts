import type { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { paramId, assertReportAccess } from '../services/caseService.js'
import { generateGuaranteeLetterPdfForCase, loadGuaranteeLetterCase } from '../services/guaranteeLetterService.js'
import {
  createOpenSignDocument,
  downloadOpenSignSignedFile,
  isValidOpenSignWebhookSecret,
  parseOpenSignWebhook,
} from '../services/openSignService.js'

const sendForSignatureSchema = z.object({
  signerName: z.string().trim().min(1, 'Signer name is required'),
  signerEmail: z.string().trim().email('Signer email is invalid'),
})

const supportedTypes = new Set(['burial', 'hospital', 'medical'])

function detailDelegate(type: string) {
  if (type === 'burial') return prisma.burialDetail
  if (type === 'hospital') return prisma.hospitalDetail
  if (type === 'medical') return prisma.medicalDetail
  throw new HttpError(400, 'OpenSign is only available for burial, hospital, and medical guarantee letters.')
}

async function updateOpenSignTracking(input: {
  caseId: string
  assistanceType: string
  documentId: string
  status: string
  signUrl: string | null
}) {
  const delegate = detailDelegate(input.assistanceType) as any
  await delegate.upsert({
    where: { caseId: input.caseId },
    update: {
      openSignDocumentId: input.documentId,
      openSignStatus: input.status,
      openSignSignUrl: input.signUrl,
      openSignSentAt: new Date(),
    },
    create: {
      caseId: input.caseId,
      openSignDocumentId: input.documentId,
      openSignStatus: input.status,
      openSignSignUrl: input.signUrl,
      openSignSentAt: new Date(),
    },
  })
}

async function findCaseByOpenSignDocumentId(documentId: string) {
  const burial = await prisma.burialDetail.findFirst({
    where: { openSignDocumentId: documentId },
    include: { case: { include: { client: true } } },
  })
  if (burial) return { assistanceType: 'burial', detail: burial, caseData: burial.case }

  const hospital = await prisma.hospitalDetail.findFirst({
    where: { openSignDocumentId: documentId },
    include: { case: { include: { client: true } } },
  })
  if (hospital) return { assistanceType: 'hospital', detail: hospital, caseData: hospital.case }

  const medical = await prisma.medicalDetail.findFirst({
    where: { openSignDocumentId: documentId },
    include: { case: { include: { client: true } } },
  })
  if (medical) return { assistanceType: 'medical', detail: medical, caseData: medical.case }

  return null
}

async function attachSignedGuaranteeLetter(input: {
  assistanceType: string
  caseId: string
  status: string
  signedGlUrl: string | null
}) {
  const delegate = detailDelegate(input.assistanceType) as any
  const update: Record<string, unknown> = {
    openSignStatus: input.status,
  }
  if (input.signedGlUrl) {
    update.signedGlUrl = input.signedGlUrl
    update.glUploadedAt = new Date()
    update.openSignSignedAt = new Date()
  }

  await delegate.update({
    where: { caseId: input.caseId },
    data: update,
  })
}

export async function sendGuaranteeLetterToOpenSign(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const body = sendForSignatureSchema.parse(req.body)
  const caseData = await loadGuaranteeLetterCase(caseId)
  assertReportAccess(caseData, req.user, 'OpenSign guarantee letter')
  if (!supportedTypes.has(caseData.assistanceType)) {
    throw new HttpError(400, 'OpenSign is only available for burial, hospital, and medical guarantee letters.')
  }
  if (caseData.status === 'released' || caseData.status === 'rejected') {
    throw new HttpError(400, `Guarantee letter cannot be sent for signature when case is ${caseData.status}.`)
  }

  const caseNumber = caseData.caseNumber ?? caseData.client.caseNumber
  const pdfBuffer = await generateGuaranteeLetterPdfForCase(caseData)
  const result = await createOpenSignDocument({
    caseId: caseData.id,
    caseNumber,
    assistanceType: caseData.assistanceType,
    pdfBuffer,
    signer: {
      name: body.signerName,
      email: body.signerEmail,
    },
  })

  await updateOpenSignTracking({
    caseId: caseData.id,
    assistanceType: caseData.assistanceType,
    documentId: result.documentId,
    status: result.status,
    signUrl: result.signUrl,
  })

  res.status(201).json({
    documentId: result.documentId,
    status: result.status,
    signUrl: result.signUrl,
  })
}

export async function openSignWebhook(req: Request, res: Response) {
  const secret = req.get('x-opensign-webhook-secret') ?? req.get('x-webhook-secret') ?? req.query.secret
  if (!isValidOpenSignWebhookSecret(secret)) {
    throw new HttpError(401, 'Invalid OpenSign webhook secret')
  }

  const payload = parseOpenSignWebhook(req.body)
  if (!payload.documentId) throw new HttpError(400, 'OpenSign webhook did not include a document ID')

  const match = await findCaseByOpenSignDocumentId(payload.documentId)
  if (!match) throw new HttpError(404, 'No AICS case is linked to this OpenSign document')

  const completed = /complete|completed|signed|finish|finished/i.test(payload.status)
  let signedGlUrl: string | null = null
  if (completed && payload.signedFileUrl) {
    const caseNumber = match.caseData.caseNumber ?? match.caseData.client.caseNumber
    signedGlUrl = await downloadOpenSignSignedFile(payload.signedFileUrl, caseNumber)
  }

  await attachSignedGuaranteeLetter({
    assistanceType: match.assistanceType,
    caseId: match.caseData.id,
    status: payload.status,
    signedGlUrl,
  })

  res.json({ ok: true, documentId: payload.documentId, signedGlUrl })
}
