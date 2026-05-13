import fs from 'node:fs'
import path from 'node:path'
import type { Express } from 'express'
import { HttpError } from '../utils/httpError.js'

type UploadKind = 'pdf' | 'png' | 'jpeg' | 'webp'
type UploadPolicy = {
  label: string
  allowedKinds: UploadKind[]
  allowedExtensions: string[]
}

type UploadValidationResult = {
  detectedKind: UploadKind
  detectedMimeType: string
}

const kindMimeType: Record<UploadKind, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const policies: Record<'portalDocument' | 'eSignature' | 'signedGl' | 'profilePhoto', UploadPolicy> = {
  portalDocument: {
    label: 'Document',
    allowedKinds: ['pdf', 'png', 'jpeg', 'webp'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  },
  eSignature: {
    label: 'Signature',
    allowedKinds: ['png', 'jpeg', 'webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
  },
  signedGl: {
    label: 'Signed guarantee letter',
    allowedKinds: ['pdf', 'png', 'jpeg', 'webp'],
    allowedExtensions: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
  },
  profilePhoto: {
    label: 'Profile photo',
    allowedKinds: ['png', 'jpeg', 'webp'],
    allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
  },
}

function detectUploadKind(header: Buffer): UploadKind | null {
  if (header.length >= 5 && header.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf'
  if (header.length >= 8 && header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return 'png'
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return 'jpeg'
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

async function readFileHeader(filePath: string, size = 16) {
  const handle = await fs.promises.open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(size)
    const { bytesRead } = await handle.read(buffer, 0, size, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function removeStoredUpload(file: Express.Multer.File | undefined | null) {
  if (!file?.path) return
  try {
    await fs.promises.unlink(file.path)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export async function validateStoredUpload(
  file: Express.Multer.File,
  policyName: keyof typeof policies,
): Promise<UploadValidationResult> {
  const policy = policies[policyName]
  const extension = path.extname(file.originalname || file.filename || '').toLowerCase()
  const header = await readFileHeader(file.path)
  const detectedKind = detectUploadKind(header)

  if (!detectedKind || !policy.allowedKinds.includes(detectedKind) || !policy.allowedExtensions.includes(extension)) {
    await removeStoredUpload(file)
    throw new HttpError(400, `${policy.label} must be a PDF, PNG, JPG, JPEG, or WEBP file.`)
  }

  const declaredMime = String(file.mimetype || '').toLowerCase()
  const detectedMimeType = kindMimeType[detectedKind]
  if (declaredMime && declaredMime !== detectedMimeType) {
    await removeStoredUpload(file)
    throw new HttpError(400, `${policy.label} file type does not match its content.`)
  }

  return { detectedKind, detectedMimeType }
}
