import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../../lib/api'
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

  const workingSteps = ['intake', 'encoding']
  const tabs = BASE_TABS

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
    const reason = window.prompt('Enter rejection reason:')
    if (reason == null) return
    if (!reason.trim()) {
      toast.error('Rejection reason is required')
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
    const confirmed = window.confirm(
      'Before submitting for review, please double-check all case study details, amounts, and attached information.\n\nProceed to submit this case for review?',
    )
    if (!confirmed) return
    await transitionStatus('for_review')
  }

  const handleUpdateCase = (updates) => {
    setCaseData((prev) => ({ ...prev, ...updates }))
  }

  const canClickStepperStep = (stepKey) => {
    if (!caseData || actionLoading) return false
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

  const activeTabKey = tabs.find((t) => location.pathname.includes(`/cases/${id}/${t.key}`))?.key ?? 'profile'

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <button onClick={() => navigate('/cases')} className="btn-ghost mb-4 text-sm">
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
                Proxy / Requestor: {caseData.proxyName || `${caseData.client?.firstName || ''} ${caseData.client?.lastName || ''}`.trim() || 'Not recorded'}
                {caseData.proxyRelationship ? ` (${caseData.proxyRelationship})` : ''}
              </p>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={caseData.status} />
            <span className={`badge ${TYPE_BADGE_CLASS[caseData.assistanceType] || 'badge-slate'}`}>
              {TYPE_LABELS[caseData.assistanceType] || caseData.assistanceType}
            </span>
            <span className="text-xs text-slate-400">SW: {caseData.socialWorkerName}</span>
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

      <CaseActionBar
        caseData={caseData}
        actionLoading={actionLoading}
        onTransition={transitionStatus}
        onReject={handleReject}
        onSubmitForReview={handleSubmitForReview}
        onApprovalStage={handleApprovalStage}
      />

      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => navigate(`/cases/${id}/${tab.key}`)}
            className={`flex-1 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
              activeTabKey === tab.key
                ? 'bg-white text-brand-primary shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Outlet context={{ caseData, onUpdate: handleUpdateCase, actionLoading }} />
    </div>
  )
}
