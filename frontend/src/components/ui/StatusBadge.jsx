import { cn, getStatusColor, getStatusLabel } from '../../lib/utils'

export default function StatusBadge({ status, className }) {
  const normalizedStatus =
    status === 'intake' || status === 'encoding'
      ? 'pending'
      : status

  return (
    <span className={cn(getStatusColor(normalizedStatus), 'badge', className)}>
      {getStatusLabel(normalizedStatus)}
    </span>
  )
}
