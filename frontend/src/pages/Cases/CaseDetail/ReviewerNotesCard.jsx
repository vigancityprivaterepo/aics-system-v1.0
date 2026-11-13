import { formatDateTime } from '../../../lib/utils'

const STAGE_LABEL = {
  for_review: 'Reviewer',
  recommending_approval: 'Recommender',
  for_approval: 'Final Approver',
}

const ACTION = {
  approved: { label: 'Approved', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  returned: { label: 'Returned', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  edited: { label: 'Edited', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  rejected: { label: 'Disapproved', className: 'border-red-200 bg-red-50 text-red-700' },
}

function meta(note) {
  return [STAGE_LABEL[note.fromStage] || note.fromStage, note.byName, note.at && formatDateTime(note.at)]
    .filter(Boolean)
    .join(' · ')
}

// Notes left by the Reviewer, Recommender or Final Approver, newest first. An
// open return (case is back with the maker) is highlighted on top.
export default function ReviewerNotesCard({ caseData }) {
  const notes = (caseData.reviewerNotes || []).filter((note) => note.notes || note.action !== 'approved')
  if (notes.length === 0) return null

  const isOpenReturn = ['encoding', 'intake'].includes(caseData.status) && notes[0].action === 'returned'
  const active = isOpenReturn ? notes[0] : null
  const earlier = active ? notes.slice(1) : notes

  return (
    <div className="card mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reviewer Notes</p>

      {active && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <p className="text-xs text-amber-700">
            {active.edited ? 'Edited and returned' : 'Returned'} by {meta(active)}
            {active.minorFix ? ' · Minor fix' : ''}
          </p>
          <p className="mt-1 whitespace-pre-wrap font-medium text-amber-900">{active.notes || 'No reason given.'}</p>
        </div>
      )}

      {earlier.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100">
          {earlier.map((note) => {
            const action = ACTION[note.edited ? 'edited' : note.action] || ACTION.approved
            return (
              <li key={note.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-full border px-2 py-0.5 font-medium ${action.className}`}>{action.label}</span>
                  {meta(note)}
                </div>
                {note.notes && <p className="mt-1 whitespace-pre-wrap text-slate-700">{note.notes}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
