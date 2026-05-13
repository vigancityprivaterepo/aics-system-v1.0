import fs from 'node:fs'
import path from 'node:path'
import { env } from '../config/env.js'
import { resolveFromUploads } from '../utils/paths.js'

const signedGlDir = resolveFromUploads('signed-gl')
const esignDir = resolveFromUploads('e-signatures')
const portalApplicationsDir = resolveFromUploads('portal-applications')
const profilePhotosDir = resolveFromUploads('profile-photos')

/** Called once at server startup — not on every request. */
export function initStorageDirs() {
  fs.mkdirSync(signedGlDir, { recursive: true })
  fs.mkdirSync(esignDir, { recursive: true })
  fs.mkdirSync(portalApplicationsDir, { recursive: true })
  fs.mkdirSync(profilePhotosDir, { recursive: true })
}

export function signedGlAbsolutePath(filename: string): string {
  return path.join(signedGlDir, filename)
}

export function signedGlPublicUrl(filename: string): string {
  return `${env.apiBaseUrl}/uploads/signed-gl/${filename}`
}

export function eSignatureDirectory(): string {
  return esignDir
}

export function eSignatureAbsolutePath(filename: string): string {
  return path.join(esignDir, filename)
}

export function eSignaturePublicUrl(filename: string): string {
  return `${env.apiBaseUrl}/uploads/e-signatures/${filename}`
}

export function portalApplicationsDirectory(): string {
  return portalApplicationsDir
}

export function profilePhotosDirectory(): string {
  return profilePhotosDir
}

export function profilePhotoPublicUrl(filename: string): string {
  return `${env.apiBaseUrl}/uploads/profile-photos/${filename}`
}
