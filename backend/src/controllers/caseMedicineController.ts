import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { assertCaseReadable, assertEditableCase, paramId } from '../services/caseService.js'
import { saveMedicinesSchema } from '../schemas/caseSchemas.js'
import { resetApprovalsAfterMaterialEdit, valuesDiffer } from '../services/workflowIntegrityService.js'
import { currencyFromDb, parseOptionalCurrency, roundCurrency } from '../utils/currency.js'

async function resolveOrCreateMedicineId(medicineName: string, unit: string | null, unitPrice: number): Promise<string> {
  const trimmedName = medicineName.trim()
  const existing = await prisma.medicineItem.findFirst({
    where: {
      OR: [
        { genericName: { equals: trimmedName, mode: 'insensitive' } },
        { brandName: { equals: trimmedName, mode: 'insensitive' } },
      ],
    },
  })
  if (existing) return existing.id

  // Case worker encoded a medicine that isn't in CHO's record of available medicines yet.
  // Auto-add it to the master list as unavailable so CHO can flip it later instead of every
  // encoded prescription needing to be manually checked with CHO first.
  const created = await prisma.medicineItem.create({
    data: {
      genericName: trimmedName,
      unit: unit || null,
      unitPrice: unitPrice > 0 ? roundCurrency(unitPrice) : 0,
      isAvailable: false,
      unavailableUpdatedAt: new Date(),
    },
  })
  return created.id
}

function serializeCaseMedicineRow(m: any) {
  return {
    id: m.id,
    medicineId: m.medicineId,
    medicineName: m.medicineName,
    quantity: Number(m.quantity),
    unit: m.unit,
    unitPrice: Number(m.unitPrice),
    totalPrice: Number(m.totalPrice),
    isAvailable: m.medicine?.isAvailable ?? true,
    medicine: m.medicine
      ? {
          isAvailable: m.medicine.isAvailable ?? true,
          updatedAt: m.medicine.updatedAt ?? null,
          availabilityUpdatedAt: m.medicine.availabilityUpdatedAt ?? null,
          availableUpdatedAt: m.medicine.availableUpdatedAt ?? null,
          unavailableUpdatedAt: m.medicine.unavailableUpdatedAt ?? null,
        }
      : null,
  }
}

export async function getMedicines(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Medicine details')

  const rows = await prisma.caseMedicine.findMany({
    where: { caseId },
    orderBy: { createdAt: 'asc' },
    include: {
      medicine: {
        select: {
          isAvailable: true,
          updatedAt: true,
          availabilityUpdatedAt: true,
          availableUpdatedAt: true,
          unavailableUpdatedAt: true,
        },
      },
    },
  })
  res.json({
    medicines: rows.map(serializeCaseMedicineRow),
  })
}

export async function saveMedicines(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const { medicines, amount } = saveMedicinesSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Medicine encoding')
  if (caseData.assistanceType !== 'medicine') throw new HttpError(400, 'Only medicine cases can store medicines')

  const resolvedMedicineIds = new Map<string, string>()
  const normalized: Array<{
    medicineId: string | null
    medicineName: string
    quantity: number
    unit: string | null
    unitPrice: number
    totalPrice: number
  }> = []
  for (const m of medicines) {
    const quantity = Number(m.quantity || 1)
    const unitPrice = Number(m.unitPrice || 0)
    const calculated = roundCurrency(Number(m.totalPrice ?? quantity * unitPrice))

    let medicineId = m.medicineId ?? null
    if (!medicineId) {
      const cacheKey = m.medicineName.trim().toLowerCase()
      medicineId = resolvedMedicineIds.get(cacheKey) ?? null
      if (!medicineId) {
        medicineId = await resolveOrCreateMedicineId(m.medicineName, m.unit ?? null, unitPrice)
        resolvedMedicineIds.set(cacheKey, medicineId)
      }
    }

    normalized.push({ medicineId, medicineName: m.medicineName, quantity, unit: m.unit ?? null, unitPrice: roundCurrency(unitPrice), totalPrice: calculated })
  }

  const existingItems = await prisma.caseMedicine.findMany({ where: { caseId: caseData.id }, orderBy: { createdAt: 'asc' } })
  const currentNormalized = existingItems.map((item) => ({
    medicineId: item.medicineId ?? null,
    medicineName: item.medicineName,
    quantity: Number(item.quantity),
    unit: item.unit ?? null,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
  }))

  const sumTotal = roundCurrency(normalized.reduce((sum, m) => sum + m.totalPrice, 0))
  const parsedAmount = parseOptionalCurrency(amount)
  const finalTotalAmount = parsedAmount != null ? parsedAmount : sumTotal
  const changedFields: string[] = []
  if (valuesDiffer(currentNormalized, normalized)) changedFields.push('medicines')
  if (valuesDiffer(caseData.amount == null ? null : Number(caseData.amount), finalTotalAmount)) changedFields.push('amount')

  const existingAuditFlags =
    typeof caseData.auditFlags === 'object' && caseData.auditFlags && !Array.isArray(caseData.auditFlags)
      ? (caseData.auditFlags as Record<string, unknown>)
      : {}
  const mergedAuditFlags: Record<string, unknown> = {
    ...existingAuditFlags,
    manual_amount_override: parsedAmount != null,
    computed_total: sumTotal,
  }
  delete mergedAuditFlags.override_reason
  delete mergedAuditFlags.override_by
  delete mergedAuditFlags.override_at

  const resetResult = await prisma.$transaction(async (tx) => {
    await tx.caseMedicine.deleteMany({ where: { caseId: caseData.id } })
    if (normalized.length > 0) {
      await tx.caseMedicine.createMany({
        data: normalized.map((m) => ({ caseId: caseData.id, ...m })),
      })
    }
    await tx.case.update({
      where: { id: caseData.id },
      data: { amount: finalTotalAmount, auditFlags: mergedAuditFlags as Prisma.InputJsonValue },
    })
    return resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields,
    })
  })

  const savedRows = await prisma.caseMedicine.findMany({
    where: { caseId: caseData.id },
    orderBy: { createdAt: 'asc' },
    include: {
      medicine: {
        select: {
          isAvailable: true,
          updatedAt: true,
          availabilityUpdatedAt: true,
          availableUpdatedAt: true,
          unavailableUpdatedAt: true,
        },
      },
    },
  })

  res.status(201).json({
    medicines: savedRows.map(serializeCaseMedicineRow),
    totalAmount: finalTotalAmount,
    status: resetResult.status ?? caseData.status,
    approvalsReset: resetResult.approvalsReset,
  })
}

export async function deleteMedicine(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const medId = paramId(req.params.medId)

  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Medicine encoding')

  await prisma.caseMedicine.deleteMany({ where: { id: medId, caseId } })

  const items = await prisma.caseMedicine.findMany({ where: { caseId } })
  const total = roundCurrency(items.reduce((sum, item) => sum + Number(item.totalPrice), 0))
  const currentAmount = currencyFromDb(caseData.amount)
  const shouldPreserveManualAmount = currentAmount > 0
  const existingAuditFlags =
    typeof caseData.auditFlags === 'object' && caseData.auditFlags && !Array.isArray(caseData.auditFlags)
      ? (caseData.auditFlags as Record<string, unknown>)
      : {}
  const mergedAuditFlags: Record<string, unknown> = {
    ...existingAuditFlags,
    manual_amount_override: shouldPreserveManualAmount,
    computed_total: total,
  }
  delete mergedAuditFlags.override_reason
  delete mergedAuditFlags.override_by
  delete mergedAuditFlags.override_at

  const resetResult = await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseId },
      data: { amount: shouldPreserveManualAmount ? currentAmount : total, auditFlags: mergedAuditFlags as Prisma.InputJsonValue },
    })
    return resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields: shouldPreserveManualAmount ? ['medicines'] : ['medicines', 'amount'],
    })
  })

  res.status(200).json({ totalAmount: shouldPreserveManualAmount ? currentAmount : total, status: resetResult.status ?? caseData.status, approvalsReset: resetResult.approvalsReset })
}
