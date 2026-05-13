import { HttpError } from './httpError.js'

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function currencyFromDb(value: unknown): number {
  if (value == null) return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return roundCurrency(parsed)
}

export function parseCurrencyAmount(value: unknown): number {
  const raw = typeof value === 'string' ? value.replace(/,/g, '').trim() : value
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, 'Amount must be a valid number.')
  }
  return Math.max(0, roundCurrency(parsed))
}

export function parseOptionalCurrency(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return parseCurrencyAmount(value)
}

export function toOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.round(parsed))
}
