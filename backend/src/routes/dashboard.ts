import { Router } from 'express'
import { AssistanceType, CaseStatus, Prisma } from '@prisma/client'
import dayjs from 'dayjs'
import { asyncHandler } from '../utils/asyncHandler.js'
import { prisma } from '../utils/prisma.js'

const router = Router()
const DASHBOARD_TYPES = [
  AssistanceType.medicine,
  AssistanceType.medical,
  AssistanceType.hospital,
  AssistanceType.burial,
  AssistanceType.eyeglass,
  AssistanceType.plain,
]

router.get('/stats', asyncHandler(async (_req, res) => {
  const now = dayjs()
  const todayStart = now.startOf('day').toDate()
  const weekStart = now.startOf('week').toDate()
  const monthStart = now.startOf('month').toDate()

  const [
    todayCases,
    weekCases,
    monthCases,
    totalClients,
    byType,
    byStatus,
    pendingRequirements,
  ] = await Promise.all([
    prisma.case.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.case.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.case.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.client.count(),
    prisma.case.groupBy({ by: ['assistanceType'], _count: { _all: true } }),
    prisma.case.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.case.count({ where: { status: 'intake' } }),
  ])

  const byTypeMap = Object.fromEntries(DASHBOARD_TYPES.map((type) => [type, 0])) as Record<string, number>
  for (const row of byType) {
    byTypeMap[row.assistanceType] = row._count._all
  }

  const byStatusMap: Record<string, number> = {
    intake: 0,
    encoding: 0,
    for_review: 0,
    recommending_approval: 0,
    for_approval: 0,
    approved: 0,
    released: 0,
    rejected: 0,
  }
  for (const row of byStatus) {
    const normalizedStatus = row.status === 'requirements' ? 'encoding' : row.status
    byStatusMap[normalizedStatus] = (byStatusMap[normalizedStatus] ?? 0) + row._count._all
  }

  res.json({
    todayCases,
    weekCases,
    monthCases,
    totalClients,
    byType: byTypeMap,
    byStatus: byStatusMap,
    pendingRequirements,
  })
}))

router.get('/charts', asyncHandler(async (req, res) => {
  const now = dayjs()
  const period = String(req.query.period ?? 'month') // day | week | month | year
  const trend: Array<Record<string, number | string>> = []

  const buildCounts = async (start: Date, end: Date, label: string) => {
    const grouped = await prisma.case.groupBy({
      by: ['assistanceType'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
    })
    const counts = Object.fromEntries(DASHBOARD_TYPES.map((t) => [t, 0])) as Record<string, number>
    for (const row of grouped) counts[row.assistanceType] = row._count._all
    return { month: label, ...counts }
  }

  if (period === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = now.subtract(i, 'day')
      trend.push(await buildCounts(d.startOf('day').toDate(), d.endOf('day').toDate(), d.format('MMM D')))
    }
  } else if (period === 'week') {
    for (let i = 7; i >= 0; i--) {
      const w = now.subtract(i, 'week')
      trend.push(await buildCounts(w.startOf('week').toDate(), w.endOf('week').toDate(), w.startOf('week').format('MMM D')))
    }
  } else if (period === 'year') {
    for (let i = 4; i >= 0; i--) {
      const y = now.subtract(i, 'year')
      trend.push(await buildCounts(y.startOf('year').toDate(), y.endOf('year').toDate(), y.format('YYYY')))
    }
  } else {
    // month (default)
    for (let i = 5; i >= 0; i--) {
      const m = now.subtract(i, 'month')
      trend.push(await buildCounts(m.startOf('month').toDate(), m.endOf('month').toDate(), m.format('MMM')))
    }
  }

  const monthly = trend

  const top = await prisma.case.groupBy({
    by: ['clientId'],
    _count: { _all: true },
    orderBy: { _count: { clientId: 'desc' } },
    take: 5,
  })

  const clientIds = top.map((t) => t.clientId)
  const clients = clientIds.length
    ? await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, barangay: true, municipality: true } })
    : []
  const clientMap = new Map(clients.map((c) => [c.id, c]))

  const topBarangays = top.map((row) => {
    const c = clientMap.get(row.clientId)
    const name = c?.barangay || c?.municipality || 'Unknown'
    return { name, cases: row._count._all }
  })

  res.json({ monthly, topBarangays })
}))

export default router
