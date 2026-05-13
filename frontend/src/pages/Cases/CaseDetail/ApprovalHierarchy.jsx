import { CheckIcon, ClockIcon, XIcon } from '../../../components/ui/Icons'

export default function ApprovalHierarchy({ reviewFlow }) {
  return (
    <div className="card">
      <p className="form-section-title mb-4">Approval Hierarchy</p>
      <div>
        {(reviewFlow || []).map((row, i, arr) => {
          const isDone     = row.state === 'approved' || row.state === 'completed'
          const isRejected = row.state === 'rejected'
          const isCurrent  = row.state === 'current'
          const isLast     = i === arr.length - 1

          const circleClass = isDone
            ? 'bg-emerald-500 text-white'
            : isRejected
            ? 'bg-red-500 text-white'
            : isCurrent
            ? 'bg-amber-400 text-white ring-4 ring-amber-100 animate-pulse'
            : 'border-2 border-slate-300 bg-white text-slate-400'

          const lineClass  = isDone ? 'bg-emerald-300' : 'bg-slate-200'
          const badgeClass = isDone ? 'badge-green' : isRejected ? 'badge-red' : isCurrent ? 'badge-amber' : 'badge-slate'
          const badgeLabel = isDone ? 'Approved'    : isRejected ? 'Rejected'  : isCurrent ? 'Current'     : 'Pending'

          return (
            <div key={row.stage} className={`relative flex items-start gap-4 ${!isLast ? 'pb-7' : ''}`}>
              {!isLast && (
                <div className={`absolute left-3 top-7 bottom-0 w-0.5 ${lineClass}`} />
              )}
              <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${circleClass}`}>
                {isDone     && <CheckIcon className="h-3.5 w-3.5" />}
                {isRejected && <XIcon     className="h-3.5 w-3.5" />}
                {isCurrent  && <ClockIcon className="h-3.5 w-3.5" />}
              </div>
              <div className="flex flex-1 items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{row.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {row.assignee?.name || 'No assignee configured'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                  {row.approval?.actedAt && (
                    <p className="text-xs text-slate-400 mt-1">{row.approval.actedAt}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
