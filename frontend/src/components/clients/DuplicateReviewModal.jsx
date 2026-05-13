import { useState } from 'react'
import { formatDate } from '../../lib/utils'

export default function DuplicateReviewModal({
  open,
  title,
  message,
  matches = [],
  currentLinkedClient = null,
  saving = false,
  createAnywayLabel = 'Create anyway',
  useExistingLabel = 'Use existing client',
  showUseExisting = true,
  onClose,
  onUseExisting,
  onCreateAnyway,
  onViewProfile,
}) {
  const [reason, setReason] = useState('')

  if (!open) return null

  const handleClose = () => {
    setReason('')
    onClose?.()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <p className="portal-kicker">Duplicate review</p>
          <h2 className="mt-1 font-display text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{message}</p>
          {currentLinkedClient && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Current portal-linked client: <span className="font-semibold">{currentLinkedClient.caseNumber}</span>
              {' '} - {currentLinkedClient.firstName} {currentLinkedClient.lastName}
            </div>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          {matches.map((match) => (
            <div key={match.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{match.fullName}</p>
                    <span className="badge badge-blue">Score {match.score}</span>
                    <span className="badge badge-slate">{match.caseNumber}</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    DOB: {formatDate(match.dateOfBirth) || '-'} | Sex: {match.sex || '-'} | Contact: {match.contactNumber || '-'}
                  </p>
                  <p className="text-sm text-slate-600">
                    {[
                      match.barangay,
                      match.municipality,
                      match.province,
                    ].filter(Boolean).join(', ') || 'No address recorded'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Applicant email: {match.applicantEmail || 'Not linked'} | Latest case: {match.latestCaseNumber || 'None'} {match.latestCaseStatus ? `(${match.latestCaseStatus})` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {match.matchReasons.map((reasonLine) => (
                      <span key={reasonLine} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        {reasonLine}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:min-w-[180px]">
                  {showUseExisting && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onUseExisting?.(match)}
                      className="portal-button-green disabled:opacity-50"
                    >
                      {useExistingLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onViewProfile?.(match)}
                    className="portal-button-secondary disabled:opacity-50"
                  >
                    View profile first
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4">
            <label className="portal-label">Reason for override</label>
            <textarea
              rows="4"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="portal-input"
              placeholder="Explain why you are proceeding despite the duplicate warning."
            />
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" disabled={saving} onClick={handleClose} className="portal-button-secondary disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || reason.trim().length < 3}
                onClick={() => onCreateAnyway?.(reason.trim())}
                className="rounded-lg border border-rose-600 bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {createAnywayLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
