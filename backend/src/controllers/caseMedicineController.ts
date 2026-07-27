import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { HttpError } from '../utils/httpError.js'
import { assertCaseReadable, assertEditableCase, paramId } from '../services/caseService.js'
import { saveMedicinesSchema } from '../schemas/caseSchemas.js'
import { resetApprovalsAfterMaterialEdit, valuesDiffer } from '../services/workflowIntegrityService.js'

export async function getMedicines(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertCaseReadable(caseData, req.user, 'Medicine details')

  const rows = await prisma.caseMedicine.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } })
  res.json({
    medicines: rows.map((m) => ({
      id: m.id,
      medicineId: m.medicineId,
      medicineName: m.medicineName,
      quantity: Number(m.quantity),
      unit: m.unit,
      unitPrice: Number(m.unitPrice),
      totalPrice: Number(m.totalPrice),
    })),
  })
}

export async function saveMedicines(req: Request, res: Response) {
  const caseId = paramId(req.params.id)
  const { medicines, amount } = saveMedicinesSchema.parse(req.body)

  const caseData = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseData) throw new HttpError(404, 'Case not found')
  assertEditableCase(caseData, req.user, 'Medicine encoding')
  if (caseData.assistanceType !== 'medicine') throw new HttpError(400, 'Only medicine cases can store medicines')

  const normalized = medicines.map((m) => {
    const quantity = Number(m.quantity || 1)
    const unitPrice = Number(m.unitPrice || 0)
    const calculated = Number(m.totalPrice ?? quantity * unitPrice)
    return { medicineId: m.medicineId ?? null, medicineName: m.medicineName, quantity, unit: m.unit ?? null, unitPrice, totalPrice: calculated }
  })

  const existingItems = await prisma.caseMedicine.findMany({ where: { caseId: caseData.id }, orderBy: { createdAt: 'asc' } })
  const currentNormalized = existingItems.map((item) => ({
    medicineId: item.medicineId ?? null,
    medicineName: item.medicineName,
    quantity: Number(item.quantity),
    unit: item.unit ?? null,
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
  }))

  const sumTotal = normalized.reduce((sum, m) => sum + m.totalPrice, 0)
  const finalTotalAmount = amount != null && amount !== '' ? Number(amount) : sumTotal
  const changedFields: string[] = []
  if (valuesDiffer(currentNormalized, normalized)) changedFields.push('medicines')
  if (valuesDiffer(caseData.amount == null ? null : Number(caseData.amount), finalTotalAmount)) changedFields.push('amount')

  const existingAuditFlags =
    typeof caseData.auditFlags === 'object' && caseData.auditFlags && !Array.isArray(caseData.auditFlags)
      ? (caseData.auditFlags as Record<string, unknown>)
      : {}
  const mergedAuditFlags: Record<string, unknown> = {
    ...existingAuditFlags,
    manual_amount_override: amount != null,
    computed_total: finalTotalAmount,
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

  res.status(201).json({
    medicines: normalized,
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
  const total = items.reduce((sum, item) => sum + Number(item.totalPrice), 0)
  const existingAuditFlags =
    typeof caseData.auditFlags === 'object' && caseData.auditFlags && !Array.isArray(caseData.auditFlags)
      ? (caseData.auditFlags as Record<string, unknown>)
      : {}
  const mergedAuditFlags: Record<string, unknown> = {
    ...existingAuditFlags,
    manual_amount_override: false,
    computed_total: total,
  }
  delete mergedAuditFlags.override_reason
  delete mergedAuditFlags.override_by
  delete mergedAuditFlags.override_at

  const resetResult = await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: caseId },
      data: { amount: total, auditFlags: mergedAuditFlags as Prisma.InputJsonValue },
    })
    return resetApprovalsAfterMaterialEdit(tx, {
      caseId: caseData.id,
      changedById: req.user?.id,
      changedFields: ['medicines', 'amount'],
    })
  })

  res.status(200).json({ totalAmount: total, status: resetResult.status ?? caseData.status, approvalsReset: resetResult.approvalsReset })
}
