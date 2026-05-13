export const statusOptions = ['submitted', 'under_review', 'resubmission_required', 'approved', 'disapproved']

export const reviewSteps = [
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents' },
  { key: 'decision', label: 'Decision' },
]

export const statusClasses = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  resubmission_required: 'bg-orange-100 text-orange-800',
  approved: 'bg-emerald-100 text-emerald-800',
  disapproved: 'bg-rose-100 text-rose-800',
  released: 'bg-violet-100 text-violet-800',
}

export function formatDate(value) {
  if (!value) return 'Not yet available'
  return new Date(value).toLocaleString()
}

export function formatStatus(status) {
  return status.replace(/_/g, ' ')
}
