import type { CaseMedicine } from '@prisma/client'

export function computeMedicineTotal(items: Array<Pick<CaseMedicine, 'quantity' | 'unitPrice' | 'totalPrice'>>): number {
  return items.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0)
}

export function isRequirementsComplete(map: Record<string, boolean>): boolean {
  return Object.values(map).every(Boolean)
}