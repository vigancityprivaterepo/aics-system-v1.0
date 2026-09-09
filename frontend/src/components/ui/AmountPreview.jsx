import { formatCurrency, numberToWords } from '../../lib/utils'

export default function AmountPreview({ amount }) {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return (
    <p className="mt-1 text-xs font-medium text-slate-600">
      = {formatCurrency(parsed)} <span className="text-slate-400">({numberToWords(parsed)})</span> — verify against the source document
    </p>
  )
}
