import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', 'templates')
const EXECUTIVE_SUMMARY_TEMPLATE = path.join(TEMPLATES_DIR, 'reportsummarytemplate.docx')

function formatCurrency(value: number) {
  return `PHP ${Number(value ?? 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function assistanceTypeLabel(value: string) {
  const labels: Record<string, string> = {
    medicine: 'Medicine',
    medical: 'Medical',
    hospital: 'Hospital',
    burial: 'Burial',
    eyeglass: 'Eyeglass',
    plain: 'Plain AICS',
  }
  return labels[value] ?? value
}

function formatDateOfReport(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const format = (value: Date) => value.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `${format(start)} to ${format(end)}`
}

type SummaryTypeRow = {
  type: string
  count: number
  amount: number
}

type SummaryStatusRow = {
  status: string
  count: number
}

export function generateExecutiveSummaryReportDocx(input: {
  from: string
  to: string
  totalCases: number
  newClients: number
  totalAmount: number
  byType: SummaryTypeRow[]
  byStatus: SummaryStatusRow[]
}) {
  const templateContent = fs.readFileSync(EXECUTIVE_SUMMARY_TEMPLATE, 'binary')
  const zip = new PizZip(templateContent)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })

  const statusCount = (status: string) => input.byStatus.find((row) => row.status === status)?.count ?? 0
  const assistanceRows = input.byType.map((row) => ({
    type: assistanceTypeLabel(row.type),
    totalcases: row.count,
    total: formatCurrency(row.amount),
  }))

  const firstAssistanceRow = assistanceRows[0] ?? { type: '-', totalcases: 0, total: formatCurrency(0) }

  doc.render({
    dateOfReport: formatDateOfReport(input.from, input.to),
    totalcases: input.totalCases,
    newClients: input.newClients,
    totalDisbursed: formatCurrency(input.totalAmount),
    averagePercase: input.totalCases ? formatCurrency(input.totalAmount / input.totalCases) : formatCurrency(0),

    type: firstAssistanceRow.type,
    total: firstAssistanceRow.total,
    assistanceRows,
    typeList: assistanceRows.map((row) => row.type).join('\n'),
    typeCasesList: assistanceRows.map((row) => row.totalcases).join('\n'),
    typeAmountsList: assistanceRows.map((row) => row.total).join('\n'),

    totalIntake: statusCount('intake'),
    totalEncoding: statusCount('encoding'),
    totalForReview: statusCount('for_review'),
    totalRP: statusCount('recommending_approval'),
    totalApproved: statusCount('approved'),
    totalRejected: statusCount('rejected'),
  })

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer
}
