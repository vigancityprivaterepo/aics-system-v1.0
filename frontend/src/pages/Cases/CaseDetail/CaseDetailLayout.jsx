import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
import { formatClientName } from '../../../lib/utils'
import CaseStepper from '../../../components/CaseStepper'
import StatusBadge from '../../../components/ui/StatusBadge'
import { ChevronLeftIcon } from '../../../components/ui/Icons'
import CaseActionBar from './CaseActionBar'

const APPROVAL_NEXT = {
  for_review: 'recommending_approval',
  recommending_approval: 'for_approval',
  for_approval: 'approved',
}

const BASE_TABS = [
  { key: 'profile', label: 'Client Profile' },
  { key: 'case-study', label: 'Case Study' },
  { key: 'case-edit', label: 'Case Edit' },
  { key: 'reports', label: 'Reports' },
]

const TYPE_LABELS = {
  medicine: 'Medicine',
  hospital: 'Hospital',
  medical: 'Medical',
  eyeglass: 'Eyeglass',
  plain: 'Plain AICS',
  burial: 'Burial',
}

const TYPE_BADGE_CLASS = {
  medicine: 'badge-green',
  hospital: 'badge-blue',
  medical: 'badge-blue',
  eyeglass: 'badge-amber',
  plain: 'badge-slate',
  burial: 'badge-slate',
}

const QUEUE_LABELS = {
  needs_intake: 'Needs Intake',
  needs_encoding: 'Needs Encoding',
  ready_for_review: 'Ready for Review',
  waiting_for_recommender: 'Waiting for Recommender',
  waiting_for_approver: 'Waiting for Approver',
  ready_for_release: 'Ready for Release',
  blocked_incomplete: 'Blocked / Incomplete',
  released: 'Released',
}

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ')
}

export default function CaseDetailLayout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const permissions = caseData?.permissions ?? {}
  const canEdit = !!permissions.canEdit
  const canManageWorkflow = !!permissions.canManageWorkflow
  const readOnlyAccess = !!caseData && !canEdit
  const tabs = canEdit ? BASE_TABS : BASE_TABS.filter((tab) => tab.key === 'reports')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await api.get(`/cases/${id}`)
        if (!cancelled) {
          setCaseData(res.data)
        }
      } catch (err) {
        if (cancelled) return
        toast.error(err.response?.data?.message || 'Unable to access case')
        navigate('/cases')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, navigate])

  useEffect(() => {
    if (location.pathname.endsWith('/requirements')) {
      navigate(`/cases/${id}/case-study`, { replace: true })
    }
  }, [id, location.pathname, navigate])

  useEffect(() => {
    if (!caseData) return

    const allowedTabKeys = new Set(tabs.map((tab) => tab.key))
    const currentTabKey = BASE_TABS.find((tab) => location.pathname.includes(`/cases/${id}/${tab.key}`))?.key

    if (!currentTabKey) return
    if (allowedTabKeys.has(currentTabKey)) return

    navigate(`/cases/${id}/reports`, { replace: true })
  }, [caseData, id, location.pathname, navigate, tabs])

  const workingSteps = ['intake', 'encoding']

  const transitionStatus = async (nextStatus, notes) => {
    if (!caseData) return
    setActionLoading(true)
    try {
      await api.patch(`/cases/${id}/status`, { status: nextStatus, notes })
      const refreshed = await api.get(`/cases/${id}`)
      setCaseData(refreshed.data)
      toast.success(`Case moved to ${statusLabel(nextStatus)}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    const reason = window.prompt('Enter disapproval reason:')
    if (reason == null) return
    if (!reason.trim()) {
      toast.error('Disapproval reason is required')
      return
    }
    await transitionStatus('rejected', reason.trim())
  }

  const handleApprovalStage = async () => {
    if (!caseData) return
    const next = APPROVAL_NEXT[caseData.status]
    if (!next) return
    await transitionStatus(next)
  }

  const handleSubmitForReview = async () => {
    if (!caseData) return
    if (!caseData.readyForReview) {
      const blockerSummary = (caseData.blockers || []).map((blocker) => `- ${blocker}`).join('\n')
      const overrideReason = window.prompt(
        `This case is not ready for review.\n\n${blockerSummary}\n\nEnter an override reason to continue:`,
      )
      if (!overrideReason?.trim()) return
      await transitionStatus('for_review', overrideReason.trim())
      return
    }

    const confirmed = window.confirm(
      'Before submitting for review, please double-check all case study details, amounts, and attached information.\n\nProceed to submit this case for review?',
    )
    if (!confirmed) return
    await transitionStatus('for_review')
  }

  const handleUpdateCase = (updates) => {
    setCaseData((prev) => ({ ...prev, ...updates }))
  }

  const goToTab = (tabKey) => {
    navigate(`/cases/${id}/${tabKey}`)
  }

  const canClickStepperStep = (stepKey) => {
    if (!caseData || actionLoading || !canManageWorkflow) return false
    const currentIndex = workingSteps.indexOf(caseData.status)
    const targetIndex = workingSteps.indexOf(stepKey)
    if (currentIndex < 0 || targetIndex < 0) return false
    return targetIndex <= currentIndex
  }

  const handleStepperClick = async (targetStatus) => {
    if (!caseData || !canClickStepperStep(targetStatus) || targetStatus === caseData.status) return
    const currentIndex = workingSteps.indexOf(caseData.status)
    const targetIndex = workingSteps.indexOf(targetStatus)
    setActionLoading(true)
    try {
      for (let i = currentIndex - 1; i >= targetIndex; i -= 1) {
        await api.patch(`/cases/${id}/status`, {
          status: workingSteps[i],
          notes: 'Returned via workflow step navigation',
        })
      }
      const refreshed = await api.get(`/cases/${id}`)
      setCaseData(refreshed.data)
      toast.success(`Moved to ${statusLabel(targetStatus)}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change step')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
      </div>
    )
  }

  if (!caseData) return null
  const activeTabKey = tabs.find((t) => location.pathname.includes(`/cases/${id}/${t.key}`))?.key ?? tabs[0]?.key ?? 'reports'

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <button onClick={() => navigate('/cases')} className="btn-ghost mb-4 text-sm min-h-[44px]">
          <ChevronLeftIcon className="h-4 w-4" />
          Back to Cases
        </button>
        <div>
          <p className="portal-kicker">Case File</p>
          <h1 className="font-mono text-2xl font-bold text-brand-primary">{caseData.caseNumber}</h1>
          {caseData.assistanceType === 'burial' && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-800">Beneficiary: {caseData.beneficiaryName || 'No deceased name recorded'}</p>
              <p className="mt-1 text-slate-500">
                Proxy / Requestor: {caseData.burialDetails?.conformeName || caseData.proxyName || formatClientName(caseData.client) || 'Not recorded'}
                {(caseData.burialDetails?.conformeRelationship || caseData.proxyRelationship) ? ` (${caseData.burialDetails?.conformeRelationship || caseData.proxyRelationship})` : ''}
              </p>
            </div>
          )}
          {caseData.assistanceType !== 'burial' && caseData.beneficiaryName && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="font-semibold text-amber-900">Beneficiary: {caseData.beneficiaryName}</p>
              <p className="mt-1 text-amber-700">
                Filed under {formatClientName(caseData.client)}'s profile
                {caseData.beneficiaryRequestorName ? ` by ${caseData.beneficiaryRequestorName}` : ''}
                {caseData.beneficiaryRequestorRelationship ? ` (${caseData.beneficiaryRequestorRelationship})` : ''}
              </p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={caseData.status} />
            <span className={`badge ${TYPE_BADGE_CLASS[caseData.assistanceType] || 'badge-slate'}`}>
              {TYPE_LABELS[caseData.assistanceType] || caseData.assistanceType}
            </span>
            <span className="text-xs text-slate-400">SW: {caseData.socialWorkerName}</span>
            {readOnlyAccess ? (
              <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Read-only access
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <CaseStepper
          status={caseData.status}
          onStepClick={handleStepperClick}
          isStepClickable={canClickStepperStep}
          steps={[
            { key: 'intake', label: 'Client Profile' },
            { key: 'encoding', label: 'Case Study' },
            { key: 'for_review', label: 'For Review' },
            { key: 'recommending_approval', label: 'Recommending' },
            { key: 'for_approval', label: 'For Approval' },
            { key: 'approved', label: 'Approved' },
            { key: 'released', label: 'Released' },
          ]}
        />
      </div>

      <div className="card mb-4 border-slate-300 bg-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workflow Guidance</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded border border-slate-900 px-2.5 py-0.5 text-xs font-medium text-slate-900">
                {QUEUE_LABELS[caseData.queue] || caseData.queue}
              </span>
              {caseData.overdue ? <span className="inline-flex items-center rounded border border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-700">Overdue</span> : null}
              {caseData.readyForReview && caseData.queue !== 'ready_for_review' ? <span className="inline-flex items-center rounded border border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-700">Ready for Review</span> : null}
            </div>
            <p className="mt-3 text-sm text-slate-900">{caseData.nextAction}</p>
            {caseData.dueAt ? (
              <p className="mt-1 text-xs text-slate-600">Due by {new Date(caseData.dueAt).toLocaleString()}</p>
            ) : null}
          </div>
          {!!caseData.blockers?.length && (
            <div className="min-w-0 lg:max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current Blockers</p>
              <ul className="mt-2 space-y-1 text-sm text-slate-800">
                {caseData.blockers.map((blocker) => (
                  <li key={blocker}>• {blocker}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {!!caseData.portalApplicationDocuments?.length && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Portal Submitted Documents</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {caseData.portalApplicationDocuments.map((document) => (
                <span key={document.id} className="inline-flex items-center rounded border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                  {document.documentType}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              These were uploaded in the portal before the staff case was created.
            </p>
          </div>
        )}
      </div>

      {(canManageWorkflow || permissions.canRelease || caseData?.status === 'released') ? (
        <CaseActionBar
          caseData={caseData}
          canManageWorkflow={canManageWorkflow}
          actionLoading={actionLoading}
          onTransition={transitionStatus}
          onReject={handleReject}
          onSubmitForReview={handleSubmitForReview}
          onApprovalStage={handleApprovalStage}
        />
      ) : null}

      <div className="mb-4 overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(`/cases/${id}/${tab.key}`)}
              className={`min-w-[100px] rounded-lg px-5 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${
                activeTabKey === tab.key
                  ? 'bg-white text-brand-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Outlet context={{ caseData, onUpdate: handleUpdateCase, actionLoading, readOnlyAccess, goToTab }} />
    </div>
  )
}



