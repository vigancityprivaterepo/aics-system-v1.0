import { useState } from 'react'
import { XIcon } from '../../../components/ui/Icons'

const STAGE_LABEL = {
  for_review: 'the reviewer',
  recommending_approval: 'the recommender',
  for_approval: 'the final approver',
}

// Which earlier stages already have a recorded approval for this case, in order —
// these are the ones a "minor fix" kickback would keep, letting the case resume at
// the current stage instead of restarting the whole chain.
function completedEarlierStages(caseData) {
  const order = ['for_review', 'recommending_approval', 'for_approval']
  const currentIndex = order.indexOf(caseData.status)
  return order
    .slice(0, currentIndex)
    .filter((stage) => caseData.approvals?.[stage]?.action === 'approved')
}

export default function ReturnToEncodingModal({ isOpen, caseData, loading, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState('minor')

  if (!isOpen) return null

  const earlierStages = completedEarlierStages(caseData)
  const hasEarlierApprovals = earlierStages.length > 0

  const handleClose = () => {
    if (loading) return
    setReason('')
    setMode('minor')
    onCancel()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!reason.trim()) return
    onConfirm(reason.trim(), hasEarlierApprovals && mode === 'minor')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Return to Encoding</h2>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="return-reason" className="portal-label">What needs to be fixed? *</label>
            <textarea
              id="return-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="portal-input"
              placeholder="e.g. Amount encoded doesn't match the attached receipt"
              autoFocus
            />
          </div>

          {hasEarlierApprovals ? (
            <div className="space-y-2">
              <p className="portal-label">How should this be resubmitted?</p>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                <input type="radio" name="return-mode" className="mt-0.5 accent-emerald-600" checked={mode === 'minor'} onChange={() => setMode('minor')} />
                <span>
                  <span className="block font-medium text-slate-800">Minor fix — skip back to me</span>
                  <span className="block text-xs text-slate-500">
                    {earlierStages.map((stage) => STAGE_LABEL[stage]).join(' and ')}'s prior sign-off is kept. Once the case maker resubmits, it comes straight back to this stage.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                <input type="radio" name="return-mode" className="mt-0.5 accent-emerald-600" checked={mode === 'full'} onChange={() => setMode('full')} />
                <span>
                  <span className="block font-medium text-slate-800">Needs full re-review</span>
                  <span className="block text-xs text-slate-500">Clears all prior sign-offs. The case goes through review, recommendation, and approval again from the start.</span>
                </span>
              </label>
            </div>
          ) : (
            <p className="text-xs text-slate-500">The case maker will need to resolve this and resubmit for review.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={handleClose} disabled={loading} className="portal-button-secondary text-sm">
            Cancel
          </button>
          <button type="submit" disabled={loading || !reason.trim()} className="portal-button-primary text-sm">
            {loading ? 'Returning...' : 'Return to Encoding'}
          </button>
        </div>
      </form>
    </div>
  )
}
