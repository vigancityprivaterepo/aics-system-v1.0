import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'
import { signedGlDirectory, signedGlPublicUrl } from './storageService.js'

export type OpenSignSigner = {
  name: string
  email: string
}

export type OpenSignCreateDocumentInput = {
  caseId: string
  caseNumber: string
  assistanceType: string
  pdfBuffer: Buffer
  signer: OpenSignSigner
}

export type OpenSignCreateDocumentResult = {
  documentId: string
  status: string
  signUrl: string | null
  raw: unknown
}

export type OpenSignWebhookPayload = {
  documentId: string | null
  status: string
  signedFileUrl: string | null
  raw: Record<string, unknown>
}

function requireOpenSignConfig() {
  if (!env.openSignBaseUrl || !env.openSignApiToken) {
    throw new HttpError(503, 'OpenSign is not configured. Set OPENSIGN_BASE_URL and OPENSIGN_API_TOKEN.')
  }

  try {
    new URL(env.openSignBaseUrl)
  } catch {
    throw new HttpError(503, 'OpenSign base URL is invalid. Check OPENSIGN_BASE_URL.')
  }
}

function joinUrl(baseUrl: string, routePath: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${routePath.replace(/^\/+/, '')}`
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function firstString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(source[key])
    if (value) return value
  }
  return null
}

function flattenResponse(value: unknown): Record<string, unknown> {
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data) ? root.data as Record<string, unknown> : {}
  const document = root.document && typeof root.document === 'object' && !Array.isArray(root.document) ? root.document as Record<string, unknown> : {}
  const object = root.object && typeof root.object === 'object' && !Array.isArray(root.object) ? root.object as Record<string, unknown> : {}
  return { ...root, ...data, ...document, ...object }
}

export function parseOpenSignWebhook(body: unknown): OpenSignWebhookPayload {
  const raw = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  const flat = flattenResponse(raw)
  return {
    documentId: firstString(flat, ['documentId', 'document_id', 'documentID', 'objectId', 'object_id', 'id', '_id']),
    status: firstString(flat, ['status', 'documentStatus', 'document_status', 'event']) ?? 'completed',
    signedFileUrl: firstString(flat, ['signedFileUrl', 'signed_file_url', 'signedUrl', 'signed_url', 'downloadUrl', 'download_url', 'fileUrl', 'file_url', 'url']),
    raw,
  }
}

export function isValidOpenSignWebhookSecret(value: unknown) {
  if (!env.openSignWebhookSecret) return true
  return stringValue(value) === env.openSignWebhookSecret
}

export async function createOpenSignDocument(input: OpenSignCreateDocumentInput): Promise<OpenSignCreateDocumentResult> {
  requireOpenSignConfig()

  const webhookUrl = env.openSignWebhookUrl || `${env.apiBaseUrl}/api/documents/opensign/webhook`
  const title = `${input.caseNumber}-guarantee-letter.pdf`
  const payload = {
    title,
    name: title,
    fileName: title,
    file: input.pdfBuffer.toString('base64'),
    fileBase64: input.pdfBuffer.toString('base64'),
    note: `AICS ${input.assistanceType} guarantee letter for case ${input.caseNumber}`,
    signers: [
      {
        name: input.signer.name,
        email: input.signer.email,
        role: 'signer',
        order: 1,
      },
    ],
    sendInOrder: true,
    webhookUrl,
    webhook_url: webhookUrl,
    metadata: {
      source: 'aics-system',
      caseId: input.caseId,
      caseNumber: input.caseNumber,
      assistanceType: input.assistanceType,
    },
  }

  const endpoint = joinUrl(env.openSignBaseUrl, env.openSignCreateDocumentPath)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': env.openSignApiToken,
        Authorization: `Bearer ${env.openSignApiToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    })
  } catch (error) {
    throw new HttpError(502, `Unable to reach OpenSign at ${endpoint}. Make sure the OpenSign server is running and OPENSIGN_BASE_URL is correct.`, {
      cause: error instanceof Error ? error.message : String(error),
    })
  }

  const responseText = await response.text()
  let body: unknown = responseText
  try {
    body = responseText ? JSON.parse(responseText) : {}
  } catch {
    body = { message: responseText }
  }

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message) : response.statusText
    throw new HttpError(502, `OpenSign rejected the document: ${message}`)
  }

  const flat = flattenResponse(body)
  const documentId = firstString(flat, ['documentId', 'document_id', 'documentID', 'objectId', 'object_id', 'id', '_id'])
  if (!documentId) {
    throw new HttpError(502, 'OpenSign did not return a document ID.')
  }

  return {
    documentId,
    status: firstString(flat, ['status', 'documentStatus', 'document_status']) ?? 'sent',
    signUrl: firstString(flat, ['signUrl', 'sign_url', 'signingUrl', 'signing_url', 'url']),
    raw: body,
  }
}

export async function downloadOpenSignSignedFile(fileUrl: string, caseNumber: string) {
  let response: Response
  try {
    response = await fetch(fileUrl, {
      headers: env.openSignApiToken ? { Authorization: `Bearer ${env.openSignApiToken}`, 'x-api-token': env.openSignApiToken } : undefined,
      signal: AbortSignal.timeout(30000),
    })
  } catch (error) {
    throw new HttpError(502, 'Unable to reach OpenSign while downloading the signed PDF.', {
      cause: error instanceof Error ? error.message : String(error),
    })
  }
  if (!response.ok) {
    throw new HttpError(502, 'Unable to download the signed PDF from OpenSign.')
  }

  const arrayBuffer = await response.arrayBuffer()
  const safeCaseNumber = caseNumber.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${Date.now()}-${safeCaseNumber}-opensign-signed-gl.pdf`
  await fs.writeFile(path.join(signedGlDirectory(), filename), Buffer.from(arrayBuffer))
  return signedGlPublicUrl(filename)
}

