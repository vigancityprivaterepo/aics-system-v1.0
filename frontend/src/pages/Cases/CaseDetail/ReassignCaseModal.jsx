import { useState } from 'react'
import { XIcon } from '../../../components/ui/Icons'

export default function ReassignCaseModal({ isOpen, caseData, employees, employeesLoading, loading, onCancel, onConfirm }) {
  const [selectedId, setSelectedId] = useState('')

  if (!isOpen) return null

  const handleClose = () => {
    if (loading) return
    setSelectedId('')
    onCancel()
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!selectedId || selectedId === caseData.socialWorkerId) return
    onConfirm(selectedId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Transfer Case Worker</h2>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-slate-500">
            Currently assigned to <span className="font-medium text-slate-800">{caseData.socialWorkerName || 'Unassigned'}</span>.
          </p>
          <div>
            <label htmlFor="reassign-worker" className="portal-label">New Case Worker *</label>
            <select
              id="reassign-worker"
              required
              autoFocus
              className="portal-input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={employeesLoading}
            >
              <option value="">{employeesLoading ? 'Loading employees...' : '- Select employee -'}</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id} disabled={u.id === caseData.socialWorkerId}>
                  {u.name}{u.id === caseData.socialWorkerId ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={handleClose} disabled={loading} className="portal-button-secondary text-sm">
            Cancel
          </button>
          <button type="submit" disabled={loading || employeesLoading || !selectedId} className="portal-button-primary text-sm">
            {loading ? 'Transferring...' : 'Transfer Case'}
          </button>
        </div>
      </form>
    </div>
  )
}
