import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import dayjs from 'dayjs'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(date) {
  if (!date) return '—'
  return dayjs(date).format('MMM DD, YYYY')
}

export function formatDateTime(date) {
  if (!date) return '—'
  return dayjs(date).format('MMM DD, YYYY h:mm A')
}

export function formatCurrency(amount) {
  if (amount == null) return '₱0.00'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function numberToWords(num) {
  if (!num) return 'Zero Pesos'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertHundreds(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '')
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertHundreds(n % 100) : '')
  }

  const integer = Math.floor(num)
  const decimal = Math.round((num - integer) * 100)

  let result = ''
  if (integer >= 1000) result += convertHundreds(Math.floor(integer / 1000)) + ' Thousand '
  result += convertHundreds(integer % 1000)
  result = result.trim() + ' Pesos'
  if (decimal > 0) result += ' and ' + convertHundreds(decimal) + ' Centavos'
  return result
}

export function generateCaseNumber(year, month, seq) {
  const y = year || new Date().getFullYear()
  const m = String(month || (new Date().getMonth() + 1)).padStart(2, '0')
  const s = String(seq).padStart(6, '0')
  return `AICS-${y}-${m}-${s}`
}

export function getStatusColor(status) {
  const map = {
    pending: 'badge-amber',
    intake: 'badge-slate',
    encoding: 'badge-blue',
    for_review: 'badge-purple',
    recommending_approval: 'badge-indigo',
    for_approval: 'badge-blue',
    approved: 'badge-green',
    released: 'badge-green',
    rejected: 'badge-red',
  }
  return map[status] || 'badge-slate'
}

export function getStatusLabel(status) {
  const map = {
    pending: 'Pending',
    intake: 'Intake',
    encoding: 'Encoding',
    for_review: 'For Review',
    recommending_approval: 'Recommending Approval',
    for_approval: 'For Approval',
    approved: 'Approved',
    released: 'Released',
    rejected: 'Rejected',
  }
  return map[status] || status
}
