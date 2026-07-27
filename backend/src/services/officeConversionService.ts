import fsSync from 'node:fs'
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

async function runLibreOfficeConversion(inputPath: string, workDir: string, format: string) {
  const binary = await resolveLibreOfficeBinary()
  if (!binary) return false

  await execFileAsync(
    binary,
    [
      '--headless',
      '--nologo',
      '--nolockcheck',
      '--convert-to',
      format,
      '--outdir',
      workDir,
      inputPath,
    ],
    { timeout: 120000 },
  )

  return true
}

export async function convertDocxBufferToPdf(buffer: Buffer, baseFilename: string): Promise<Buffer | null> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aics-gl-'))
  const inputPath = path.join(workDir, `${baseFilename}.docx`)
  const outputPath = path.join(workDir, `${baseFilename}.pdf`)

  try {
    await fs.writeFile(inputPath, buffer)
    if (!(await runLibreOfficeConversion(inputPath, workDir, 'pdf'))) return null
    if (!(await fileExists(outputPath))) return null
    return await fs.readFile(outputPath)
  } catch (error) {
    console.warn('[GuaranteeLetter PDF Conversion] Falling back to PDFKit output.', error)
    return null
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

function contentTypeFor(filename: string) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

function inlineHtmlAssets(html: string, workDir: string) {
  return html.replace(/\s(src|href)=(['"])([^'"#][^'"]*)\2/gi, (match, attr, quote, rawUrl) => {
    try {
      if (/^(?:https?:|data:|mailto:|#)/i.test(rawUrl)) return match
      const assetPath = path.resolve(workDir, decodeURIComponent(String(rawUrl).replace(/^\.\//, '')))
      if (!assetPath.startsWith(workDir)) return match
      const data = fsSync.readFileSync(assetPath)
      return ` ${attr}=${quote}data:${contentTypeFor(assetPath)};base64,${data.toString('base64')}${quote}`
    } catch {
      return match
    }
  })
}

export async function convertDocxBufferToHtml(buffer: Buffer, baseFilename: string): Promise<string | null> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aics-docx-html-'))
  const inputPath = path.join(workDir, `${baseFilename}.docx`)
  const outputPath = path.join(workDir, `${baseFilename}.html`)

  try {
    await fs.writeFile(inputPath, buffer)
    if (!(await runLibreOfficeConversion(inputPath, workDir, 'html'))) return null
    if (!(await fileExists(outputPath))) return null
    const html = await fs.readFile(outputPath, 'utf8')
    return inlineHtmlAssets(html, workDir)
  } catch (error) {
    console.warn('[DOCX HTML Conversion] LibreOffice HTML preview unavailable.', error)
    return null
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

export function buildConversionBasename(prefix: string) {
  return `${prefix}-${randomUUID()}`
}