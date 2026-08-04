import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { env } from '../config/env.js'
import { stripBlankPdfPages } from './pdfBlankPageService.js'

const execFileAsync = promisify(execFile)
const LIBREOFFICE_PROFILE_DIR = path.join(os.tmpdir(), 'aics-libreoffice-profile-v1')
const PDF_CONVERSION_CACHE_DIR = path.join(os.tmpdir(), 'aics-docx-pdf-cache-v1')
const MAX_CACHED_PDF_CONVERSIONS = 128

let libreOfficeBinaryPromise: Promise<string | null> | null = null
let libreOfficeConversionQueue: Promise<void> = Promise.resolve()
const pdfConversionInFlight = new Map<string, Promise<Buffer | null>>()

async function fileExists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function commandExists(command: string) {
  try {
    await execFileAsync(command, ['--version'], { timeout: 5000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

async function findLibreOfficeBinary() {
  const fileCandidates = [
    env.libreOfficePath,
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  ].filter(Boolean)

  for (const candidate of fileCandidates) {
    if (await fileExists(candidate)) return candidate
  }

  const commandCandidates = [env.libreOfficePath, 'soffice', 'libreoffice']
    .filter((candidate) => candidate && !path.isAbsolute(candidate))

  for (const candidate of commandCandidates) {
    if (await commandExists(candidate)) return candidate
  }

  return null
}

function resolveLibreOfficeBinary() {
  libreOfficeBinaryPromise ??= findLibreOfficeBinary()
  return libreOfficeBinaryPromise
}

function queueLibreOfficeConversion<T>(task: () => Promise<T>): Promise<T> {
  const queued = libreOfficeConversionQueue.then(task, task)
  libreOfficeConversionQueue = queued.then(() => undefined, () => undefined)
  return queued
}

async function runLibreOfficeConversion(inputPath: string, workDir: string, format: string) {
  const binary = await resolveLibreOfficeBinary()
  if (!binary) return false

  return queueLibreOfficeConversion(async () => {
    await fs.mkdir(LIBREOFFICE_PROFILE_DIR, { recursive: true })

    await execFileAsync(
      binary,
      [
        `-env:UserInstallation=${pathToFileURL(LIBREOFFICE_PROFILE_DIR).href}`,
        '--headless',
        '--nologo',
        '--nodefault',
        '--nofirststartwizard',
        '--norestore',
        '--convert-to',
        format,
        '--outdir',
        workDir,
        inputPath,
      ],
      { timeout: 120000, windowsHide: true },
    )

    return true
  })
}

function pdfConversionCacheKey(buffer: Buffer) {
  return createHash('sha256').update('docx-to-pdf-v1').update(buffer).digest('hex')
}

function isPdfBuffer(buffer: Buffer | null | undefined) {
  return !!buffer?.length && buffer.subarray(0, 5).toString('ascii') === '%PDF-'
}

async function readCachedPdf(cachePath: string) {
  try {
    const buffer = await fs.readFile(cachePath)
    return isPdfBuffer(buffer) ? buffer : null
  } catch {
    return null
  }
}

async function prunePdfConversionCache() {
  try {
    const entries = await fs.readdir(PDF_CONVERSION_CACHE_DIR, { withFileTypes: true })
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.pdf'))
        .map(async (entry) => {
          const filePath = path.join(PDF_CONVERSION_CACHE_DIR, entry.name)
          const stat = await fs.stat(filePath)
          return { filePath, modifiedAt: stat.mtimeMs }
        }),
    )

    files.sort((left, right) => right.modifiedAt - left.modifiedAt)
    await Promise.all(files.slice(MAX_CACHED_PDF_CONVERSIONS).map(({ filePath }) => fs.rm(filePath, { force: true })))
  } catch {
    // Cache cleanup must never block document conversion.
  }
}

async function convertDocxBufferToPdfUncached(buffer: Buffer, baseFilename: string, cachePath: string) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aics-gl-'))
  const inputPath = path.join(workDir, `${baseFilename}.docx`)
  const outputPath = path.join(workDir, `${baseFilename}.pdf`)

  try {
    await fs.writeFile(inputPath, buffer)
    if (!(await runLibreOfficeConversion(inputPath, workDir, 'pdf'))) return null
    if (!(await fileExists(outputPath))) return null

    const converted = await fs.readFile(outputPath)
    if (!isPdfBuffer(converted)) return null

    const cleaned = await stripBlankPdfPages(converted)

    await fs.mkdir(PDF_CONVERSION_CACHE_DIR, { recursive: true })
    await fs.writeFile(cachePath, cleaned)
    void prunePdfConversionCache()
    return cleaned
  } catch (error) {
    console.warn('[GuaranteeLetter PDF Conversion] Falling back to PDFKit output.', error)
    return null
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

export async function convertDocxBufferToPdf(buffer: Buffer, baseFilename: string): Promise<Buffer | null> {
  const cacheKey = pdfConversionCacheKey(buffer)
  const cachePath = path.join(PDF_CONVERSION_CACHE_DIR, `${cacheKey}.pdf`)
  const cached = await readCachedPdf(cachePath)
  if (cached) return cached

  const existingTask = pdfConversionInFlight.get(cacheKey)
  if (existingTask) return existingTask

  const task = convertDocxBufferToPdfUncached(buffer, baseFilename, cachePath)
    .finally(() => pdfConversionInFlight.delete(cacheKey))
  pdfConversionInFlight.set(cacheKey, task)

  return task
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
