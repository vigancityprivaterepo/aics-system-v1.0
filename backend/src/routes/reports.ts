import { Router } from 'express'
import dayjs from 'dayjs'
import { CaseStatus } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { generateExecutiveSummaryReportDocx } from '../services/reportDocxService.js'

const router = Router()
const REPORT_TYPES = ['medicine', 'medical', 'hospital', 'burial', 'eyeglass', 'plain'] as const
const REPORT_BASIS_VALUES = ['created', 'assessment', 'approved', 'released'] as const
const PENDING_STATUSES: CaseStatus[] = ['intake', 'requirements', 'encoding', 'for_review', 'recommending_approval', 'for_approval']
const STATUS_BASIS_TO_STATUS = {
  approved: 'approved',
  released: 'released',
} as const

type ReportBasis = typeof REPORT_BASIS_VALUES[number]

type ReportCase = any

function normalizeWorkflowStatus(status: string) {
  return status === 'requirements' ? 'encoding' : status
}

function normalizeStatusForDb(status: string | undefined) {
  if (!status) return undefined
  if (status === 'encoding') return { in: ['encoding', 'requirements'] as CaseStatus[] }
  return status as CaseStatus
}

function parseBasis(value: unknown): ReportBasis {
  const normalized = String(value ?? 'created').trim().toLowerCase()
  if ((REPORT_BASIS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as ReportBasis
  }
  return 'created'
}

function basisLabel(basis: ReportBasis) {
  const labels: Record<ReportBasis, string> = {
    created: 'Created Date',
    assessment: 'Assessment Date',
    approved: 'Approved Date',
    released: 'Released Date',
  }
  return labels[basis]
}

function dateRange(from: string, to: string) {
  return {
    gte: dayjs(from).startOf('day').toDate(),
    lte: dayjs(to).endOf('day').toDate(),
  }
}

function formatDate(value: Date | null | undefined) {
  return value ? dayjs(value).format('YYYY-MM-DD') : null
}

function roundDays(value: number) {
  return Math.round(value * 10) / 10
}

function elapsedDays(from: Date | null | undefined, to: Date | null | undefined) {
  if (!from || !to) return null
  return roundDays(Math.max(0, dayjs(to).diff(from, 'day', true)))
}

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) => row.map((value) => {
      const cell = String(value ?? '')
      if (/[",\r\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`
      return cell
    }).join(','))
    .join('\r\n')
}

function sendCsv(res: any, filename: string, rows: Array<Array<string | number | null | undefined>>) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(`\uFEFF${toCsv(rows)}`)
}

async function loadBasisEventDates(basis: Extract<ReportBasis, 'approved' | 'released'>, from: string, to: string) {
  const logs = await prisma.caseStatusLog.findMany({
    where: {
      toStatus: STATUS_BASIS_TO_STATUS[basis],
      changedAt: dateRange(from, to),
    },
    orderBy: { changedAt: 'desc' },
    select: {
      caseId: true,
      changedAt: true,
    },
  })

  const eventDateByCaseId = new Map<string, Date>()
  for (const log of logs) {
    if (!eventDateByCaseId.has(log.caseId)) {
      eventDateByCaseId.set(log.caseId, log.changedAt)
    }
  }
  return eventDateByCaseId
}

async function loadCasesForReport(options: {
  from: string
  to: string
  basis: ReportBasis
  type?: string
  status?: string
  barangay?: string
  municipality?: string
}) {
  const basis = options.basis
  const clientWhere = {
    ...(options.barangay
      ? { barangay: { equals: options.barangay.trim(), mode: 'insensitive' as const } }
      : {}),
    ...(options.municipality
      ? { municipality: { equals: options.municipality.trim(), mode: 'insensitive' as const } }
      : {}),
  }
  const where = {
    ...(options.type ? { assistanceType: options.type as typeof REPORT_TYPES[number] } : {}),
    ...(options.status ? { status: normalizeStatusForDb(options.status) } : {}),
    ...(Object.keys(clientWhere).length > 0 ? { client: clientWhere } : {}),
  }

  let eventDateByCaseId = new Map<string, Date>()
  let cases: ReportCase[] = []

  if (basis === 'created') {
    cases = await prisma.case.findMany({
      where: {
        ...where,
        createdAt: dateRange(options.from, options.to),
      },
      include: {
        client: {
          select: {
            caseNumber: true,
            firstName: true,
            lastName: true,
            barangay: true,
            municipality: true,
            is4ps: true,
            isPwd: true,
            isSenior: true,
          },
        },
        burialDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
        hospitalDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
        medicalDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    for (const row of cases) eventDateByCaseId.set(row.id, row.createdAt)
    return { cases, eventDateByCaseId }
  }

  if (basis === 'assessment') {
    cases = await prisma.case.findMany({
      where: {
        ...where,
        dateOfAssessment: dateRange(options.from, options.to),
      },
      include: {
        client: {
          select: {
            caseNumber: true,
            firstName: true,
            lastName: true,
            barangay: true,
            municipality: true,
            is4ps: true,
            isPwd: true,
            isSenior: true,
          },
        },
        burialDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
        hospitalDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
        medicalDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
      },
      orderBy: { dateOfAssessment: 'desc' },
    })
    for (const row of cases) {
      if (row.dateOfAssessment) eventDateByCaseId.set(row.id, row.dateOfAssessment)
    }
    return { cases, eventDateByCaseId }
  }

  eventDateByCaseId = await loadBasisEventDates(basis, options.from, options.to)
  const caseIds = [...eventDateByCaseId.keys()]
  if (caseIds.length === 0) return { cases: [], eventDateByCaseId }

  cases = await prisma.case.findMany({
    where: {
      ...where,
      id: { in: caseIds },
    },
    include: {
      client: {
        select: {
          caseNumber: true,
          firstName: true,
          lastName: true,
          barangay: true,
          municipality: true,
          is4ps: true,
          isPwd: true,
          isSenior: true,
        },
      },
      burialDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
      hospitalDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
      medicalDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
    },
  })

  cases.sort((a, b) => (eventDateByCaseId.get(b.id)?.getTime() ?? 0) - (eventDateByCaseId.get(a.id)?.getTime() ?? 0))
  return { cases, eventDateByCaseId }
}

async function loadCaseStatusLogs(caseIds: string[]) {
  if (caseIds.length === 0) return []
  return prisma.caseStatusLog.findMany({
    where: { caseId: { in: caseIds } },
    orderBy: [{ caseId: 'asc' }, { changedAt: 'asc' }],
    select: {
      caseId: true,
      fromStatus: true,
      toStatus: true,
      changedAt: true,
    },
  })
}

async function loadSummaryReport(from: string, to: string, basis: ReportBasis) {
  const { cases } = await loadCasesForReport({ from, to, basis })

  const byTypeMap = new Map<string, { type: string; count: number; amount: number }>()
  const byStatusMap = new Map<string, number>()
  let totalAmount = 0
  const distinctClientIds = new Set<string>()
  let is4psCount = 0
  let isPwdCount = 0
  let isSeniorCount = 0

  for (const row of REPORT_TYPES) {
    byTypeMap.set(row, { type: row, count: 0, amount: 0 })
  }

  for (const c of cases) {
    totalAmount += Number(c.amount ?? 0)
    distinctClientIds.add(c.clientId)
    const typeRow = byTypeMap.get(c.assistanceType) ?? { type: c.assistanceType, count: 0, amount: 0 }
    typeRow.count += 1
    typeRow.amount += Number(c.amount ?? 0)
    byTypeMap.set(c.assistanceType, typeRow)

    const normalizedStatus = normalizeWorkflowStatus(c.status)
    byStatusMap.set(normalizedStatus, (byStatusMap.get(normalizedStatus) ?? 0) + 1)

    if (c.client.is4ps) is4psCount += 1
    if (c.client.isPwd) isPwdCount += 1
    if (c.client.isSenior) isSeniorCount += 1
  }

  return {
    period: { from, to },
    basis,
    basisLabel: basisLabel(basis),
    totalCases: cases.length,
    totalAmount,
    distinctClients: distinctClientIds.size,
    demographics: {
      is4ps: is4psCount,
      isPwd: isPwdCount,
      isSenior: isSeniorCount,
    },
    byType: [...byTypeMap.values()],
    byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
  }
}

async function loadOperationsReport(from: string, to: string, basis: ReportBasis) {
  const { cases } = await loadCasesForReport({ from, to, basis })
  const caseIds = cases.map((row) => row.id)
  const logs = await loadCaseStatusLogs(caseIds)
  const logsByCaseId = new Map<string, Array<(typeof logs)[number]>>()
  for (const log of logs) {
    const bucket = logsByCaseId.get(log.caseId) ?? []
    bucket.push(log)
    logsByCaseId.set(log.caseId, bucket)
  }

  const backlogMap = new Map<string, { status: string; count: number; avgDays: number; maxDays: number }>()
  const approvalDurations: number[] = []
  const releaseDurations: number[] = []
  const workerLoadMap = new Map<string, { worker: string; cases: number; amount: number }>()
  let approvedCount = 0
  let releasedCount = 0
  let pendingCount = 0

  for (const c of cases) {
    const caseLogs = logsByCaseId.get(c.id) ?? []
    const approvalLog = [...caseLogs].reverse().find((log) => log.toStatus === 'approved')
    const releaseLog = [...caseLogs].reverse().find((log) => log.toStatus === 'released')

    if (approvalLog) {
      const days = elapsedDays(c.createdAt, approvalLog.changedAt)
      if (days != null) approvalDurations.push(days)
      approvedCount += 1
    }
    if (releaseLog) {
      const days = elapsedDays(c.createdAt, releaseLog.changedAt)
      if (days != null) releaseDurations.push(days)
      releasedCount += 1
    }

    if (PENDING_STATUSES.includes(c.status)) {
      pendingCount += 1
      const latestStageAt = [...caseLogs].reverse().find((log) => log.toStatus === c.status)?.changedAt ?? c.createdAt
      const ageDays = elapsedDays(latestStageAt, new Date()) ?? 0
      const normalizedStatus = normalizeWorkflowStatus(c.status)
      const current = backlogMap.get(normalizedStatus) ?? { status: normalizedStatus, count: 0, avgDays: 0, maxDays: 0 }
      current.count += 1
      current.avgDays += ageDays
      current.maxDays = Math.max(current.maxDays, ageDays)
      backlogMap.set(normalizedStatus, current)
    }

    const worker = String(c.socialWorkerName ?? 'Unassigned').trim() || 'Unassigned'
    const workload = workerLoadMap.get(worker) ?? { worker, cases: 0, amount: 0 }
    workload.cases += 1
    workload.amount += Number(c.amount ?? 0)
    workerLoadMap.set(worker, workload)
  }

  const backlog = [...backlogMap.values()]
    .map((row) => ({ ...row, avgDays: row.count > 0 ? roundDays(row.avgDays / row.count) : 0 }))
    .sort((a, b) => b.count - a.count)

  const workerLoad = [...workerLoadMap.values()].sort((a, b) => b.cases - a.cases || b.amount - a.amount)

  return {
    period: { from, to },
    basis,
    basisLabel: basisLabel(basis),
    throughput: {
      approvedCount,
      releasedCount,
      pendingCount,
    },
    turnaround: {
      approvalAverageDays: approvalDurations.length > 0 ? roundDays(approvalDurations.reduce((sum, value) => sum + value, 0) / approvalDurations.length) : null,
      releaseAverageDays: releaseDurations.length > 0 ? roundDays(releaseDurations.reduce((sum, value) => sum + value, 0) / releaseDurations.length) : null,
    },
    backlog,
    workerLoad,
  }
}

router.get('/summary', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  res.json(await loadSummaryReport(from, to, basis))
}))

router.get('/summary/docx', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  const summary = await loadSummaryReport(from, to, basis)
  const buffer = generateExecutiveSummaryReportDocx({
    from,
    to,
    totalCases: summary.totalCases,
    newClients: summary.distinctClients,
    totalAmount: summary.totalAmount,
    byType: summary.byType,
    byStatus: summary.byStatus,
  })

  const fileName = `executive-summary-${basis}-${from}_to_${to}.docx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.send(buffer)
}))

router.get('/summary/csv', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  const summary = await loadSummaryReport(from, to, basis)

  sendCsv(res, `report-summary-${basis}-${from}_to_${to}.csv`, [
    ['Metric', 'Value'],
    ['Report Basis', summary.basisLabel],
    ['From', from],
    ['To', to],
    ['Total Cases', summary.totalCases],
    ['Total Amount', summary.totalAmount],
    ['Distinct Clients', summary.distinctClients],
    ['4Ps Beneficiaries', summary.demographics.is4ps],
    ['PWD Beneficiaries', summary.demographics.isPwd],
    ['Senior Beneficiaries', summary.demographics.isSenior],
    [],
    ['Assistance Type', 'Cases', 'Amount'],
    ...summary.byType.map((row) => [row.type, row.count, row.amount]),
    [],
    ['Status', 'Cases'],
    ...summary.byStatus.map((row) => [row.status, row.count]),
  ])
}))

router.get('/cases', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  const type = typeof req.query.type === 'string' ? req.query.type : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const barangay = typeof req.query.barangay === 'string' ? req.query.barangay : undefined
  const municipality = typeof req.query.municipality === 'string' ? req.query.municipality : undefined
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  const { cases, eventDateByCaseId } = await loadCasesForReport({ from, to, basis, type, status, barangay, municipality })
  const total = cases.length
  const pageCases = cases.slice((page - 1) * limit, page * limit)

  res.json({
    period: { from, to },
    basis,
    basisLabel: basisLabel(basis),
    total,
    page,
    limit,
    cases: pageCases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber ?? null,
      clientId: c.client.caseNumber,
      clientName: `${c.client.lastName}, ${c.client.firstName}`,
      barangay: c.client.barangay ?? '-',
      municipality: c.client.municipality ?? '-',
      assistanceType: c.assistanceType,
      status: normalizeWorkflowStatus(c.status),
      amount: Number(c.amount ?? 0),
      socialWorkerName: c.socialWorkerName ?? '-',
      dateOfAssessment: formatDate(c.dateOfAssessment),
      basisDate: formatDate(eventDateByCaseId.get(c.id)),
      is4ps: c.client.is4ps,
      isPwd: c.client.isPwd,
      isSenior: c.client.isSenior,
      createdAt: formatDate(c.createdAt),
    })),
  })
}))

router.get('/cases/csv', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  const type = typeof req.query.type === 'string' ? req.query.type : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const barangay = typeof req.query.barangay === 'string' ? req.query.barangay : undefined
  const municipality = typeof req.query.municipality === 'string' ? req.query.municipality : undefined
  const { cases, eventDateByCaseId } = await loadCasesForReport({ from, to, basis, type, status, barangay, municipality })

  sendCsv(res, `report-cases-${basis}-${from}_to_${to}.csv`, [
    ['Case Number', 'Client ID', 'Client Name', 'Barangay', 'Municipality', 'Assistance Type', 'Current Status', 'Amount', 'Social Worker', basisLabel(basis), 'Assessment Date', 'Created Date', '4Ps', 'PWD', 'Senior'],
    ...cases.map((c) => [
      c.caseNumber ?? '',
      c.client.caseNumber,
      `${c.client.lastName}, ${c.client.firstName}`,
      c.client.barangay ?? '',
      c.client.municipality ?? '',
      c.assistanceType,
      normalizeWorkflowStatus(c.status),
      Number(c.amount ?? 0),
      c.socialWorkerName ?? '',
      formatDate(eventDateByCaseId.get(c.id)),
      formatDate(c.dateOfAssessment),
      formatDate(c.createdAt),
      c.client.is4ps ? 'Yes' : 'No',
      c.client.isPwd ? 'Yes' : 'No',
      c.client.isSenior ? 'Yes' : 'No',
    ]),
  ])
}))

router.get('/barangay', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)

  const { cases } = await loadCasesForReport({ from, to, basis })
  const map = new Map<string, {
    barangay: string
    municipality: string
    total: number
    medicine: number
    medical: number
    hospital: number
    burial: number
    eyeglass: number
    plain: number
    amount: number
  }>()

  for (const c of cases) {
    const key = `${c.client.barangay ?? 'Unknown'}|${c.client.municipality ?? ''}`
    const existing = map.get(key) ?? {
      barangay: c.client.barangay ?? 'Unknown',
      municipality: c.client.municipality ?? '-',
      total: 0,
      medicine: 0,
      medical: 0,
      hospital: 0,
      burial: 0,
      eyeglass: 0,
      plain: 0,
      amount: 0,
    }
    existing.total += 1
    if (REPORT_TYPES.includes(c.assistanceType as typeof REPORT_TYPES[number])) {
      existing[c.assistanceType as typeof REPORT_TYPES[number]] += 1
    }
    existing.amount += Number(c.amount ?? 0)
    map.set(key, existing)
  }

  const rows = [...map.values()].sort((a, b) => b.total - a.total || b.amount - a.amount)
  res.json({ period: { from, to }, basis, basisLabel: basisLabel(basis), rows })
}))

router.get('/barangay/csv', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  const { cases } = await loadCasesForReport({ from, to, basis })

  const map = new Map<string, {
    barangay: string
    municipality: string
    total: number
    medicine: number
    medical: number
    hospital: number
    burial: number
    eyeglass: number
    plain: number
    amount: number
  }>()

  for (const c of cases) {
    const key = `${c.client.barangay ?? 'Unknown'}|${c.client.municipality ?? ''}`
    const existing = map.get(key) ?? {
      barangay: c.client.barangay ?? 'Unknown',
      municipality: c.client.municipality ?? '-',
      total: 0,
      medicine: 0,
      medical: 0,
      hospital: 0,
      burial: 0,
      eyeglass: 0,
      plain: 0,
      amount: 0,
    }
    existing.total += 1
    if (REPORT_TYPES.includes(c.assistanceType as typeof REPORT_TYPES[number])) {
      existing[c.assistanceType as typeof REPORT_TYPES[number]] += 1
    }
    existing.amount += Number(c.amount ?? 0)
    map.set(key, existing)
  }

  const rows = [...map.values()].sort((a, b) => b.total - a.total || b.amount - a.amount)
  sendCsv(res, `report-barangay-${basis}-${from}_to_${to}.csv`, [
    ['Barangay', 'Municipality', 'Medicine', 'Medical', 'Hospital', 'Burial', 'Eyeglass', 'Plain', 'Total Cases', 'Amount'],
    ...rows.map((row) => [
      row.barangay,
      row.municipality,
      row.medicine,
      row.medical,
      row.hospital,
      row.burial,
      row.eyeglass,
      row.plain,
      row.total,
      row.amount,
    ]),
  ])
}))

router.get('/operations', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  res.json(await loadOperationsReport(from, to, basis))
}))

router.get('/operations/csv', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  const report = await loadOperationsReport(from, to, basis)

  sendCsv(res, `report-operations-${basis}-${from}_to_${to}.csv`, [
    ['Metric', 'Value'],
    ['Report Basis', report.basisLabel],
    ['From', from],
    ['To', to],
    ['Approved Cases', report.throughput.approvedCount],
    ['Released Cases', report.throughput.releasedCount],
    ['Pending Cases', report.throughput.pendingCount],
    ['Average Approval Days', report.turnaround.approvalAverageDays ?? ''],
    ['Average Release Days', report.turnaround.releaseAverageDays ?? ''],
    [],
    ['Backlog Status', 'Count', 'Average Days', 'Max Days'],
    ...report.backlog.map((row) => [row.status, row.count, row.avgDays, row.maxDays]),
    [],
    ['Worker', 'Cases', 'Amount'],
    ...report.workerLoad.map((row) => [row.worker, row.cases, row.amount]),
  ])
}))

router.get('/guarantee-letters', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)

  const { cases } = await loadCasesForReport({ from, to, basis })
  const guaranteeCases = cases
    .filter((c) => ['burial', 'hospital', 'medical'].includes(c.assistanceType))
    .map((c) => {
      const detail =
        c.assistanceType === 'burial'
          ? c.burialDetails
          : c.assistanceType === 'hospital'
            ? c.hospitalDetails
            : c.medicalDetails
      return {
        id: c.id,
        caseNumber: c.caseNumber ?? c.client.caseNumber,
        clientName: `${c.client.lastName}, ${c.client.firstName}`,
        assistanceType: c.assistanceType,
        status: normalizeWorkflowStatus(c.status),
        amount: Number(c.amount ?? 0),
        signedGlUrl: detail?.signedGlUrl ?? null,
        glUploadedAt: detail?.glUploadedAt ?? null,
        createdAt: formatDate(c.createdAt),
      }
    })

  res.json({
    period: { from, to },
    basis,
    basisLabel: basisLabel(basis),
    items: guaranteeCases,
  })
}))

router.get('/guarantee-letters/csv', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const basis = parseBasis(req.query.basis)
  const { cases } = await loadCasesForReport({ from, to, basis })
  const items = cases
    .filter((c) => ['burial', 'hospital', 'medical'].includes(c.assistanceType))
    .map((c) => {
      const detail =
        c.assistanceType === 'burial'
          ? c.burialDetails
          : c.assistanceType === 'hospital'
            ? c.hospitalDetails
            : c.medicalDetails
      return [
        c.caseNumber ?? c.client.caseNumber,
        `${c.client.lastName}, ${c.client.firstName}`,
        c.assistanceType,
        normalizeWorkflowStatus(c.status),
        Number(c.amount ?? 0),
        detail?.signedGlUrl ? 'Signed' : 'Pending',
        formatDate(detail?.glUploadedAt ?? null),
      ]
    })

  sendCsv(res, `report-guarantee-letters-${basis}-${from}_to_${to}.csv`, [
    ['Case Number', 'Client Name', 'Type', 'Current Status', 'Amount', 'GL Status', 'Upload Date'],
    ...items,
  ])
}))

export default router
