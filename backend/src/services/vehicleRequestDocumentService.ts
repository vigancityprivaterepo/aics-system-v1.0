import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { currencyFromDb } from '../utils/currency.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
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
  zip.file('word/document.xml', fixedXml)
  return zip
}

export function generateVehicleRequestDocx(request: any) {
  const zip = prepareTemplate()
  const selected = (type: string) => request.vehicleType === type ? '☑' : '☐'
  const available = request.availability === 'available'
  const unavailable = request.availability === 'unavailable'
  const total = ['driverPerDiem', 'rentalFees', 'tollFees', 'otherFees', 'fuelExpenses']
    .reduce((sum, field) => sum + currencyFromDb(request[field]), 0)

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '' })
  doc.render({
    controlNumber: request.requestNumber,
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