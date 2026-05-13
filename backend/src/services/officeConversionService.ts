import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { env } from '../config/env.js'

const execFileAsync = promisify(execFile)

async function fileExists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function resolveLibreOfficeBinary() {
  const candidates = [
    env.libreOfficePath,
    'soffice',
    'libreoffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (candidate === 'soffice' || candidate === 'libreoffice') return candidate
    if (await fileExists(candidate)) return candidate
  }

  return null
}

export async function convertDocxBufferToPdf(buffer: Buffer, baseFilename: string): Promise<Buffer | null> {
  const binary = await resolveLibreOfficeBinary()
  if (!binary) return null

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aics-gl-'))
  const inputPath = path.join(workDir, `${baseFilename}.docx`)
  const outputPath = path.join(workDir, `${baseFilename}.pdf`)

  try {
    await fs.writeFile(inputPath, buffer)
    await execFileAsync(
      binary,
      [
        '--headless',
        '--nologo',
        '--nolockcheck',
        '--convert-to',
        'pdf',
        '--outdir',
        workDir,
        inputPath,
      ],
      { timeout: 120000 },
    )

    if (!(await fileExists(outputPath))) return null
    return await fs.readFile(outputPath)
  } catch (error) {
    console.warn('[GuaranteeLetter PDF Conversion] Falling back to PDFKit output.', error)
    return null
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

export function buildConversionBasename(prefix: string) {
  return `${prefix}-${randomUUID()}`
}
