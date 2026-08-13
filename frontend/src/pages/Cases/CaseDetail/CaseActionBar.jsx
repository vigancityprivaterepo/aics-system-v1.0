import { ArrowRightIcon, XIcon } from '../../../components/ui/Icons'
import { formatDate, formatDateTime } from '../../../lib/utils'

const APPROVAL_FLOW = ['for_review', 'recommending_approval', 'for_approval']
const APPROVAL_BUTTON_LABEL = {
  for_review: 'Approve Review',
  recommending_approval: 'Recommend Approval',
  for_approval: 'Final Approve',
}

export default function CaseActionBar({
  caseData,
  canManageWorkflow,
  actionLoading,
  onTransition,
  onReject,
  onSubmitForReview,
  onApprovalStage,
  onReturnToEncoding,
}) {
  const { status } = caseData
  const blockerCount = caseData.blockers?.length || 0
  const canRelease = !!caseData.permissions?.canRelease
  const rejectionApproval = Object.values(caseData.approvals ?? {}).find((approval) => approval?.action === 'rejected')

  if (status === 'released') {
    if (!caseData.releasedAt) return null
    return (
      <div className="card mb-4 flex items-center gap-3 border-l-4 border-emerald-600">
        <div className="text-sm">
          <p className="font-semibold text-slate-800">Released on {formatDateTime(caseData.releasedAt)}</p>
          {caseData.releasedByName && <p className="text-slate-500">by {caseData.releasedByName}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="card mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {status === 'rejected' && (
        <>
          <div className="text-sm">
            <p className="text-slate-600">This case was disapproved. Re-open it to return to encoding and correct any issues.</p>
            {rejectionApproval && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="font-semibold text-red-800">
                  Disapproval findings
                  {rejectionApproval.actedByName ? ` — ${rejectionApproval.actedByName}` : ''}
                  {rejectionApproval.actedAt ? ` (${formatDate(rejectionApproval.actedAt)})` : ''}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-red-700">{rejectionApproval.notes || 'No reason was provided.'}</p>
              </div>
            )}
          </div>
          {canManageWorkflow && (
            <button
              onClick={() => onTransition('encoding')}
              disabled={actionLoading}
              className="portal-button-secondary text-sm"
            >
              {actionLoading ? 'Reopening...' : 'Re-open Case'}
            </button>
          )}
        </>
      )}
      {canManageWorkflow && status === 'intake' && (
        <>
          <p className="text-sm text-slate-600">Confirm intake is complete, then proceed directly to case study.</p>
          <button
            onClick={() => onTransition('encoding')}
            disabled={actionLoading}
            className="portal-button-primary text-sm"
          >
            {actionLoading ? 'Saving...' : 'Continue to Case Study'}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </>
      )}

      {canManageWorkflow && status === 'encoding' && (
        <>
          <p className="text-sm text-slate-600">
            {caseData.readyForReview
              ? 'Case is ready for review. Submit it when you are done checking the encoded details.'
              : `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} must be resolved before review, unless you submit with an override reason.`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onTransition('intake')}
              disabled={actionLoading}
              className="portal-button-secondary text-sm"
            >
              Back to Client Profile
            </button>
            <button
              onClick={onSubmitForReview}
              disabled={actionLoading}
              className="portal-button-primary text-sm"
            >
              {actionLoading ? 'Submitting...' : caseData.readyForReview ? 'Submit for Review' : 'Submit with Override'}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {canManageWorkflow && APPROVAL_FLOW.includes(status) && (
        <>
          <p className="text-sm text-slate-600">
            {status === 'for_review'
              ? 'Reviewer decision is required before case can proceed.'
              : status === 'recommending_approval'
                ? 'Recommending approval decision is required for final approver routing.'
                : 'Final approver decision is required before release.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onReturnToEncoding}
              disabled={actionLoading}
              className="portal-button-secondary text-sm"
            >
              Return to Encoding
            </button>
            <button
              onClick={onReject}
              disabled={actionLoading}
              className="portal-button-red text-sm"
            >
              <XIcon className="h-4 w-4" />
              Disapproved
            </button>
            <button
              onClick={onApprovalStage}
              disabled={actionLoading}
              className="portal-button-primary text-sm"
            >
              {actionLoading ? 'Approving...' : (APPROVAL_BUTTON_LABEL[status] || 'Approve')}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {status === 'approved' && (
        <>
          <p className="text-sm text-slate-600">
            {canRelease
              ? 'Release the approved case when disbursement is done.'
              : 'This case is approved and awaiting release by an administrative employee.'}
          </p>
          {canRelease && (
            <button
              onClick={() => onTransition('released')}
              disabled={actionLoading}
              className="portal-button-primary text-sm"
            >
              {actionLoading ? 'Releasing...' : 'Mark as Released'}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  )
}
