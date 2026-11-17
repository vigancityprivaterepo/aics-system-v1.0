import { useState } from 'react'
import { XIcon } from '../../../components/ui/Icons'

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
            <label htmlFor="return-reason" className="portal-label">Reason *</label>
            <textarea
              id="return-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="portal-input"
              placeholder="What needs to be fixed"
              autoFocus
            />
          </div>

          {hasEarlierApprovals && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['minor', 'Minor fix', 'Keeps earlier sign-offs; the case comes straight back to you'],
                ['full', 'Full re-review', 'Clears all sign-offs; the case starts review again'],
              ].map(([value, label, hint]) => (
                <label key={value} title={hint} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                  <input type="radio" name="return-mode" className="accent-emerald-600" checked={mode === value} onChange={() => setMode(value)} />
                  <span className="font-medium text-slate-800">{label}</span>
                </label>
              ))}
            </div>
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
