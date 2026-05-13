import { formatDate, formatStatus, statusClasses } from './reviewerConfig'
import { AlertTriangle } from 'lucide-react'

function buildVisiblePages(page, totalPages) {
  return Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((value) => value === 1 || value === totalPages || Math.abs(value - page) <= 1)
    .reduce((items, value, index, values) => {
      if (index > 0 && value - values[index - 1] > 1) items.push('...')
      items.push(value)
      return items
    }, [])
}

export default function PortalApplicationsQueue({
  loading,
  applications,
  selectedId,
  selectedIds,
  onSelectApplication,
  onToggleSelection,
  page,
  totalPages,
  total,
  onChangePage,
}) {
  return (
    <section className="card overflow-hidden border border-slate-200 bg-white p-0 shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-sm font-semibold text-slate-700">Reviewer Queue</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Scan the queue, select an application, then review its documents and decision panel.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
        </div>
      ) : applications.length === 0 ? (
        <div className="portal-empty">
          <p className="font-medium text-slate-500">No portal applications found</p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {applications.map((application) => {
            const isSelected = selectedId === application.id
            const checked = selectedIds.includes(application.id)
            const showSubmissionWarning = application.status === 'submitted'

            return (
              <button
                key={application.id}
                type="button"
                onClick={() => onSelectApplication(application.id)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  isSelected
                    ? 'border-emerald-300 bg-emerald-50/60 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelection(application.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      aria-label={`Select ${application.referenceNumber || 'portal application'}`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-500 capitalize">
                          {application.assistanceType} assistance
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-emerald-900">
                          {application.referenceNumber || 'Pending reference number'}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-700">
                          {application.applicant?.lastName}, {application.applicant?.firstName}
                        </p>
                        {showSubmissionWarning ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            New portal application needs review
                          </div>
                        ) : null}
                      </div>

                      <span className={`badge ${statusClasses[application.status] || statusClasses.submitted}`}>
                        {formatStatus(application.status)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-1.5 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-3">
                      <span>Submitted: {formatDate(application.submittedAt)}</span>
                      <span>Documents: {application.documents?.length || 0}</span>
                      <span className="sm:col-span-2 xl:col-span-1">{application.applicant?.email || 'No email provided'}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages} - {total} total
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChangePage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            {buildVisiblePages(page, totalPages).map((item, index) => (
              item === '...'
                ? <span key={`ellipsis-${index}`} className="px-1 py-1.5 text-xs text-slate-400">...</span>
                : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onChangePage(item)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      item === page
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item}
                  </button>
                )
            ))}
            <button
              type="button"
              onClick={() => onChangePage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
