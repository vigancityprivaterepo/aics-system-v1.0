import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const backendRoot = path.resolve(currentDir, '..', '..')
export const uploadsRoot = path.resolve(backendRoot, env.uploadsRoot)

export function resolveFromUploads(...parts: string[]) {
  return path.resolve(uploadsRoot, ...parts)
}
