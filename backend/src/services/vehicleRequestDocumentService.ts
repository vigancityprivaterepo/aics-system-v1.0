import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { currencyFromDb } from '../utils/currency.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const ImageModule = require('../../vendor/docxtemplater-image-module-safe/index.cjs')
const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nmJkAAAAASUVORK5CYII=', 'base64')
const templatePath = path.resolve(currentDir, '..', '..', '..', 'templates', 'Vehicle Use Request Form-Vehicle Use Agreement (Revised 04-23-2026).docx')

function formatDate(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(date)
}

function formatMoney(value: unknown) {
  return currencyFromDb(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function readSignatureImage(value: unknown) {
  const raw = String(value ?? '').trim()
  const marker = '/uploads/e-signatures/'
  const markerIndex = raw.indexOf(marker)
  if (markerIndex >= 0) {
    const filename = decodeURIComponent(raw.slice(markerIndex + marker.length).split(/[?#]/)[0])
    const absolutePath = path.resolve(process.cwd(), 'uploads', 'e-signatures', filename)
    if (fs.existsSync(absolutePath)) return fs.readFileSync(absolutePath)
  }
  return transparentPixel
}

function prepareTemplate() {
  const zip = new PizZip(fs.readFileSync(templatePath))
  const documentXml = zip.file('word/document.xml')?.asText()
  if (!documentXml) throw new Error('Vehicle request template document.xml is missing')
  let occurrence = 0
  let fixedXml = documentXml.replace(/\{checkMark\}/g, () => {
    occurrence += 1
    return occurrence === 1 ? '{chAvailable}' : '{chNotAvailable}'
  })
  fixedXml = fixedXml.replace(/<w:p\b[^>]*w14:paraId="(?:3452274D|65E5F4A8)"[\s\S]*?<\/w:p>/g, '')

  // 1. Remove Word spell-check / proofing markers (<w:proofErr.../>) that split tags across runs
  fixedXml = fixedXml.replace(/<w:proofErr[^>]*\/>/g, '')

  // 2. Convert split or direct {approverMayor} / {appverMayor} to {%approverMayor}
  const openBrace = /<w:t>\{<\/w:t>/
  const closeTag = /<\/w:t>/
  const notAnotherBrace = /(?:(?!<w:t>\{<\/w:t>)[^])*?/

  for (const tag of ['approverMayor', 'appverMayor']) {
    fixedXml = fixedXml.replace(
      new RegExp(openBrace.source + `(${notAnotherBrace.source}<w:t>)${tag}` + closeTag.source, 'g'),
      `<w:t>{%</w:t>$1approverMayor</w:t>`
    )
    fixedXml = fixedXml.replace(
      new RegExp(`<w:t>\\{${tag}\\}` + closeTag.source, 'g'),
      `<w:t>{%approverMayor}</w:t>`
    )
  }

  zip.file('word/document.xml', fixedXml)
  return zip
}

export function generateVehicleRequestDocx(request: any, mayorSignatureUrl: string | null = null) {
  const zip = prepareTemplate()
  const selected = (type: string) => request.vehicleType === type ? '☑' : '☐'
  const available = request.availability === 'available'
  const unavailable = request.availability === 'unavailable'
  const total = ['driverPerDiem', 'rentalFees', 'tollFees', 'otherFees', 'fuelExpenses']
    .reduce((sum, field) => sum + currencyFromDb(request[field]), 0)

  const isApproved = request.status === 'approved' || request.status === 'processed'
  const effectiveMayorSignature = isApproved ? mayorSignatureUrl : null

  const imageModule = new ImageModule({ getImage: readSignatureImage, getSize: () => [120, 45] })
  const doc = new Docxtemplater(zip, { modules: [imageModule], paragraphLoop: true, linebreaks: true, nullGetter: () => '' })
  doc.render({
    controlNumber: request.requestNumber,
    approverMayor: effectiveMayorSignature,
    chCC: selected('city_coaster'), chCB: selected('city_bus'), chMan: selected('manlift'),
    choth: selected('other'), chT: selected('truck'), chVan: selected('van'), chAmbu: selected('ambulance'),
    InputSpecify: request.otherVehicle ?? '',
    dateDropdown: formatDate(request.requestDate), inputName: request.requestedBy,
    officeDropdown: request.office, addressDropdown: request.address, purposeDropdown: request.purpose,
    destinationDropdown: request.destination, departureDropdown: formatDate(request.departureDate),
    timeDeparture: request.departureTime, arrivalDropdown: formatDate(request.arrivalDate),
    timeArrival: request.arrivalTime, numberOfPass: String(request.numberOfPassengers),
    'ifVehicleis?': request.availability === 'pending' ? 'Pending assessment' : request.availability,
    chAvailable: available ? '☑' : '☐', chNotAvailable: unavailable ? '☑' : '☐',
    modelInput: request.vehicleModel ?? '', reasonUnavailability: request.unavailableReason ?? '',
    plateInput: request.plateNumber ?? '', inputAltRequest: request.alternativeVehicle ?? '',
    modelAltRequest: request.alternativeModel ?? '', plateAltRequest: request.alternativePlate ?? '',
    perdieDriver: formatMoney(request.driverPerDiem), rentalFees: formatMoney(request.rentalFees),
    tollFees: formatMoney(request.tollFees), otherFees: formatMoney(request.otherFees),
    fuelExpenses: formatMoney(request.fuelExpenses), totalExpenses: formatMoney(total),
    Remarks: request.remarks ?? '', date: formatDate(new Date()),
  })
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}