import { Router } from 'express'
import dayjs from 'dayjs'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { generateExecutiveSummaryReportDocx } from '../services/reportDocxService.js'

const router = Router()
const REPORT_TYPES = ['medicine', 'medical', 'hospital', 'burial', 'eyeglass'] as const

function normalizeWorkflowStatus(status: string) {
  return status === 'requirements' ? 'encoding' : status
}

function dateRange(from: string, to: string) {
  return {
    gte: dayjs(from).startOf('day').toDate(),
    lte: dayjs(to).endOf('day').toDate(),
  }
}

async function loadSummaryReport(from: string, to: string) {
  const range = dateRange(from, to)

  const [byType, byStatus, totalAmount, totalClients] = await Promise.all([
    prisma.case.groupBy({
      by: ['assistanceType'],
      where: { createdAt: range },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.case.groupBy({
      by: ['status'],
      where: { createdAt: range },
      _count: { _all: true },
    }),
    prisma.case.aggregate({
      where: { createdAt: range },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.client.count({ where: { createdAt: range } }),
  ])

  const byStatusMap = new Map<string, number>()
  for (const row of byStatus) {
    const normalizedStatus = normalizeWorkflowStatus(row.status)
    byStatusMap.set(normalizedStatus, (byStatusMap.get(normalizedStatus) ?? 0) + row._count._all)
  }

  return {
    period: { from, to },
    totalCases: totalAmount._count._all,
    totalAmount: Number(totalAmount._sum.amount ?? 0),
    newClients: totalClients,
    byType: byType.map((r) => ({
      type: r.assistanceType,
      count: r._count._all,
      amount: Number(r._sum.amount ?? 0),
    })),
    byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({
      status,
      count,
    })),
  }
}

router.get('/summary', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  res.json(await loadSummaryReport(from, to))
}))

router.get('/summary/docx', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const summary = await loadSummaryReport(from, to)
  const buffer = generateExecutiveSummaryReportDocx({
    from,
    to,
    totalCases: summary.totalCases,
    newClients: summary.newClients,
    totalAmount: summary.totalAmount,
    byType: summary.byType,
    byStatus: summary.byStatus,
  })

  const fileName = `executive-summary-${from}_to_${to}.docx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.send(buffer)
}))

router.get('/cases', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const type = req.query.type as string | undefined
  const status = req.query.status as string | undefined
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100)
  const page = Math.max(Number(req.query.page ?? 1), 1)

  const where = {
    createdAt: dateRange(from, to),
    ...(type ? { assistanceType: type as any } : {}),
    ...(status ? { status: status as any } : {}),
  }

  const [total, cases] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  res.json({
    period: { from, to },
    total,
    page,
    limit,
    cases: cases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber ?? null,
      clientId:   c.client.caseNumber,
      clientName: `${c.client.lastName}, ${c.client.firstName}`,
      barangay: c.client.barangay ?? '—',
      municipality: c.client.municipality ?? '—',
      assistanceType: c.assistanceType,
      status: normalizeWorkflowStatus(c.status),
      amount: Number(c.amount ?? 0),
      socialWorkerName: c.socialWorkerName ?? '—',
      dateOfAssessment: c.dateOfAssessment
        ? dayjs(c.dateOfAssessment).format('YYYY-MM-DD')
        : null,
      is4ps: c.client.is4ps,
      isPwd: c.client.isPwd,
      isSenior: c.client.isSenior,
      createdAt: dayjs(c.createdAt).format('YYYY-MM-DD'),
    })),
  })
}))

router.get('/barangay', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to = String(req.query.to ?? dayjs().endOf('month').format('YYYY-MM-DD'))

  const cases = await prisma.case.findMany({
    where: { createdAt: dateRange(from, to) },
    select: {
      assistanceType: true,
      amount: true,
      client: { select: { barangay: true, municipality: true } },
    },
  })

  const map = new Map<string, {
    barangay: string
    municipality: string
    total: number
    medicine: number
    medical: number
    hospital: number
    burial: number
    eyeglass: number
    amount: number
  }>()

  for (const c of cases) {
    const key = `${c.client.barangay ?? 'Unknown'}|${c.client.municipality ?? ''}`
    const existing = map.get(key) ?? {
      barangay: c.client.barangay ?? 'Unknown',
      municipality: c.client.municipality ?? '—',
      total: 0,
      medicine: 0,
      medical: 0,
      hospital: 0,
      burial: 0,
      eyeglass: 0,
      amount: 0,
    }
    existing.total++
    if (REPORT_TYPES.includes(c.assistanceType as typeof REPORT_TYPES[number])) {
      existing[c.assistanceType as typeof REPORT_TYPES[number]]++
    }
    existing.amount += Number(c.amount ?? 0)
    map.set(key, existing)
  }

  const rows = [...map.values()].sort((a, b) => b.total - a.total)

  res.json({ period: { from, to }, rows })
}))

router.get('/guarantee-letters', asyncHandler(async (req, res) => {
  const from = String(req.query.from ?? dayjs().startOf('month').format('YYYY-MM-DD'))
  const to   = String(req.query.to   ?? dayjs().endOf('month').format('YYYY-MM-DD'))
  const range = dateRange(from, to)

  const cases = await prisma.case.findMany({
    where: {
      createdAt: range,
      assistanceType: { in: ['burial', 'hospital', 'medical'] },
    },
    include: {
      client: { select: { firstName: true, lastName: true, caseNumber: true } },
      burialDetails:  { select: { signedGlUrl: true, glUploadedAt: true } },
      hospitalDetails: { select: { signedGlUrl: true, glUploadedAt: true } },
      medicalDetails:  { select: { signedGlUrl: true, glUploadedAt: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json({
    period: { from, to },
    items: cases.map((c) => {
      const detail =
        c.assistanceType === 'burial'   ? c.burialDetails  :
        c.assistanceType === 'hospital' ? c.hospitalDetails :
        c.medicalDetails
      return {
        id:             c.id,
        caseNumber:     c.caseNumber ?? c.client.caseNumber,
        clientName:     `${c.client.lastName}, ${c.client.firstName}`,
        assistanceType: c.assistanceType,
        status:         normalizeWorkflowStatus(c.status),
        amount:         Number(c.amount ?? 0),
        signedGlUrl:    detail?.signedGlUrl   ?? null,
        glUploadedAt:   detail?.glUploadedAt  ?? null,
        createdAt:      dayjs(c.createdAt).format('YYYY-MM-DD'),
      }
    }),
  })
}))

export default router
