import {
  ClipboardCheck,
  FileText,
  Files,
  LayoutDashboard,
  Activity,
} from 'lucide-react'

const navIcons = {
  applications: LayoutDashboard,
  overview: ClipboardCheck,
  documents: Files,
  decision: FileText,
  monitoring: Activity,
}

export default function PortalApplicationsToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  loading,
  applicationsCount,
  allSelected,
  selectedIdsCount,
  deleting,
  onToggleSelectAll,
  onBulkDelete,
  navItems,
  activeNavKey,
  onNavigate,
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex min-w-max items-center gap-1 px-3 py-2.5">
          {navItems.map((item) => {
            const Icon = navIcons[item.key] || LayoutDashboard
            const isActive = activeNavKey === item.key

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-rose-500 text-white'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="portal-page-title">Portal Applications</h1>
            <p className="portal-page-subtitle">Review applicant-filed requests, inspect uploaded documents, and update processing status.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
            <input
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="portal-input"
              placeholder="Search applicant or reference number"
            />
            <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="portal-input">
              <option value="">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="resubmission_required">Resubmission required</option>
              <option value="approved">Approved</option>
              <option value="disapproved">Disapproved</option>
              <option value="released">Released</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Bulk Actions</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {selectedIdsCount
                ? `${selectedIdsCount} application(s) selected for reviewer actions.`
                : 'Select one or more applications to delete.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onToggleSelectAll}
              disabled={loading || applicationsCount === 0}
              className="portal-button-secondary text-xs disabled:opacity-50"
            >
              {allSelected ? 'Clear Selection' : 'Select All'}
            </button>
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={deleting || selectedIdsCount === 0}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              Delete Selected ({selectedIdsCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
