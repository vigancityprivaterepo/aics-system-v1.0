import { ArrowRightIcon, XIcon } from '../../../components/ui/Icons'

const APPROVAL_FLOW = ['for_review', 'recommending_approval', 'for_approval']
const APPROVAL_BUTTON_LABEL = {
  for_review: 'Approve Review',
  recommending_approval: 'Recommend Approval',
  for_approval: 'Final Approve',
}

export default function CaseActionBar({
  caseData,
  actionLoading,
  onTransition,
  onReject,
  onSubmitForReview,
  onApprovalStage,
}) {
  const { status } = caseData

  if (status === 'released') return null

  return (
    <div className="card mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {status === 'rejected' && (
        <>
          <p className="text-sm text-slate-600">This case was rejected. Re-open it to return to encoding and correct any issues.</p>
          <button
            onClick={() => onTransition('encoding')}
            disabled={actionLoading}
            className="portal-button-secondary text-sm"
          >
            {actionLoading ? 'Reopening...' : 'Re-open Case'}
          </button>
        </>
      )}
      {status === 'intake' && (
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

      {status === 'encoding' && (
        <>
          <p className="text-sm text-slate-600">
            {caseData.assistanceType === 'plain'
              ? 'After saving the plain AICS details, submit this case for review.'
              : 'After saving case study details, submit this case for review.'}
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
              {actionLoading ? 'Submitting...' : 'Submit for Review'}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {APPROVAL_FLOW.includes(status) && (
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
              onClick={() => onTransition('encoding')}
              disabled={actionLoading}
              className="portal-button-secondary text-sm"
            >
              Return to Encoding
            </button>
            <button
              onClick={onReject}
              disabled={actionLoading}
              className="portal-button-secondary text-sm"
            >
              <XIcon className="h-4 w-4" />
              Reject
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
          <p className="text-sm text-slate-600">Release the approved case when disbursement is done.</p>
          <button
            onClick={() => onTransition('released')}
            disabled={actionLoading}
            className="portal-button-primary text-sm"
          >
            {actionLoading ? 'Releasing...' : 'Mark as Released'}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
