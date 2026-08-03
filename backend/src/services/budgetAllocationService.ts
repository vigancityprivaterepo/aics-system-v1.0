import { AssistanceType, CaseStatus } from '@prisma/client'
import { currencyFromDb, roundCurrency } from '../utils/currency.js'
import { HttpError } from '../utils/httpError.js'

const ASSISTANCE_TYPES: AssistanceType[] = [
  AssistanceType.medicine,
  AssistanceType.medical,
  AssistanceType.hospital,
  AssistanceType.burial,
  AssistanceType.eyeglass,
  AssistanceType.plain,
]

const TYPE_LABELS: Record<AssistanceType, string> = {
  medicine: 'Medicine',
  medical: 'Medical',
  hospital: 'Hospital',
  burial: 'Burial',
  eyeglass: 'Eyeglass',
  plain: 'Plain AICS',
}

const RESERVED_STATUSES: CaseStatus[] = ['approved', 'released']

function positiveInteger(value: number, fallback: number) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function currentBudgetPeriod(referenceDate = new Date()) {
  return {
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth() + 1,
  }
}

export function formatBudgetPeriod(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
}

export function assistanceTypeLabel(type: AssistanceType) {
  return TYPE_LABELS[type] ?? type
}

function toPeriodKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function caseAmount(caseRow: any) {
  const directAmount = currencyFromDb(caseRow?.amount)
  if (directAmount > 0) return directAmount
  if (caseRow?.assistanceType !== AssistanceType.medicine) return directAmount
  const medicineTotal = Array.isArray(caseRow?.medicines)
    ? caseRow.medicines.reduce((sum: number, item: any) => sum + currencyFromDb(item?.totalPrice), 0)
    : 0
  return roundCurrency(medicineTotal)
}

export async function listBudgetAllocationsForPeriod(
  db: any,
  yearInput?: number,
  monthInput?: number,
) {
  const current = currentBudgetPeriod()
  const year = positiveInteger(yearInput ?? 0, current.year)
  const month = positiveInteger(monthInput ?? 0, current.month)

  const [allocations, reservedCases] = await Promise.all([
    db.budgetAllocation.findMany({
      where: {
        allocationYear: year,
        allocationMonth: month,
      },
      orderBy: { assistanceType: 'asc' },
    }),
    db.case.findMany({
      where: {
        isArchived: false,
        status: { in: RESERVED_STATUSES },
        budgetAllocation: {
          allocationYear: year,
          allocationMonth: month,
        },
      },
      select: {
        id: true,
        assistanceType: true,
        amount: true,
        budgetAllocationId: true,
      },
    }),
  ])

  const allocationByType = new Map<AssistanceType, any>(
    allocations.map((row: any) => [row.assistanceType as AssistanceType, row]),
  )
  const utilizationByType = new Map<AssistanceType, { caseCount: number; utilizedAmount: number }>()

  for (const row of reservedCases) {
    const type = row.assistanceType as AssistanceType
    const bucket = utilizationByType.get(type) ?? { caseCount: 0, utilizedAmount: 0 }
    bucket.caseCount += 1
    bucket.utilizedAmount = roundCurrency(bucket.utilizedAmount + currencyFromDb(row.amount))
    utilizationByType.set(type, bucket)
  }

  const rows = ASSISTANCE_TYPES.map((type) => {
    const allocation = allocationByType.get(type) ?? null
    const utilization = utilizationByType.get(type) ?? { caseCount: 0, utilizedAmount: 0 }
    const allocatedAmount = currencyFromDb(allocation?.allocatedAmount)
    const remainingAmount = roundCurrency(allocatedAmount - utilization.utilizedAmount)

    return {
      assistanceType: type,
      label: assistanceTypeLabel(type),
      periodYear: year,
      periodMonth: month,
      periodKey: toPeriodKey(year, month),
      periodLabel: formatBudgetPeriod(year, month),
      allocationId: allocation?.id ?? null,
      allocatedAmount,
      utilizedAmount: utilization.utilizedAmount,
      remainingAmount,
      caseCount: utilization.caseCount,
      notes: allocation?.notes ?? '',
      isConfigured: !!allocation,
    }
  })

  return {
    period: {
      year,
      month,
      key: toPeriodKey(year, month),
      label: formatBudgetPeriod(year, month),
    },
    allocations: rows,
  }
}

export async function ensureBudgetReservation(db: any, caseRow: any) {
  const amount = caseAmount(caseRow)
  if (!(amount > 0)) {
    throw new HttpError(400, 'Case amount must be encoded before final approval.')
  }

  const { year, month } = currentBudgetPeriod()
  const periodLabel = formatBudgetPeriod(year, month)
  const allocation = await db.budgetAllocation.findUnique({
    where: {
      assistanceType_allocationYear_allocationMonth: {
        assistanceType: caseRow.assistanceType,
        allocationYear: year,
        allocationMonth: month,
      },
    },
  })

  if (!allocation) {
    throw new HttpError(
      400,
      `No ${periodLabel} budget allocation is configured for ${assistanceTypeLabel(caseRow.assistanceType)} assistance.`,
    )
  }

  const reservedCases = await db.case.findMany({
    where: {
      isArchived: false,
      status: { in: RESERVED_STATUSES },
      budgetAllocationId: allocation.id,
    },
    select: {
      id: true,
      amount: true,
    },
  })

  const utilizedAmount = roundCurrency(
    reservedCases.reduce((sum: number, row: any) => sum + currencyFromDb(row.amount), 0),
  )
  const allocatedAmount = currencyFromDb(allocation.allocatedAmount)
  const remainingAmount = roundCurrency(allocatedAmount - utilizedAmount)

  if (remainingAmount < amount) {
    throw new HttpError(
      400,
      `${assistanceTypeLabel(caseRow.assistanceType)} budget for ${periodLabel} has only PHP ${remainingAmount.toFixed(2)} remaining. This case needs PHP ${amount.toFixed(2)}.`,
    )
  }

  return {
    allocation,
    amount,
    utilizedAmount,
    allocatedAmount,
    remainingAmount,
    periodLabel,
  }
}

export async function getCaseBudgetStatus(db: any, caseRow: any) {
  const amount = caseAmount(caseRow)

  if (caseRow?.budgetAllocationId) {
    const allocation = await db.budgetAllocation.findUnique({
      where: { id: caseRow.budgetAllocationId },
    })

    if (!allocation) {
      return {
        assistanceType: caseRow.assistanceType,
        label: assistanceTypeLabel(caseRow.assistanceType),
        amount,
        reserved: false,
        allocationMissing: true,
        message: 'This case does not have a valid reserved budget allocation.',
      }
    }

    const snapshot = await listBudgetAllocationsForPeriod(db, allocation.allocationYear, allocation.allocationMonth)
    const row = snapshot.allocations.find((item) => item.allocationId === allocation.id)

    return {
      assistanceType: caseRow.assistanceType,
      label: assistanceTypeLabel(caseRow.assistanceType),
      amount,
      reserved: true,
      allocationMissing: false,
      status: caseRow.status,
      periodYear: allocation.allocationYear,
      periodMonth: allocation.allocationMonth,
      periodLabel: formatBudgetPeriod(allocation.allocationYear, allocation.allocationMonth),
      allocatedAmount: row?.allocatedAmount ?? currencyFromDb(allocation.allocatedAmount),
      utilizedAmount: row?.utilizedAmount ?? 0,
      remainingAmount: row?.remainingAmount ?? 0,
      notes: allocation.notes ?? '',
      message: `Reserved against the ${formatBudgetPeriod(allocation.allocationYear, allocation.allocationMonth)} allocation.`,
    }
  }

  const snapshot = await listBudgetAllocationsForPeriod(db)
  const row = snapshot.allocations.find((item) => item.assistanceType === caseRow.assistanceType)
  if (!row) return null

  return {
    assistanceType: caseRow.assistanceType,
    label: row.label,
    amount,
    reserved: false,
    allocationMissing: !row.isConfigured,
    status: caseRow.status,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    periodLabel: row.periodLabel,
    allocatedAmount: row.allocatedAmount,
    utilizedAmount: row.utilizedAmount,
    remainingAmount: row.remainingAmount,
    notes: row.notes,
    message: row.isConfigured
      ? `Current ${row.periodLabel} budget has PHP ${row.remainingAmount.toFixed(2)} remaining.`
      : `No ${row.periodLabel} budget allocation is configured yet for ${row.label}.`,
  }
}
