import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import PortalApplicationsToolbar from '../../components/portal-applications/PortalApplicationsToolbar'
import PortalApplicationsQueue from '../../components/portal-applications/PortalApplicationsQueue'
import PortalApplicationReviewPanel from '../../components/portal-applications/PortalApplicationReviewPanel'
import { reviewSteps, statusOptions } from '../../components/portal-applications/reviewerConfig'
import DuplicateReviewModal from '../../components/clients/DuplicateReviewModal'

const APP_STATUS_CLASSES = {
  submitted: 'bg-amber-100 text-amber-800',
  under_review: 'bg-blue-100 text-blue-800',
  resubmission_required: 'bg-orange-100 text-orange-800',
  approved: 'bg-emerald-100 text-emerald-800',
  disapproved: 'bg-rose-100 text-rose-800',
  released: 'bg-violet-100 text-violet-800',
}

const TRACKER_STEPS = [
  { key: 'submitted',             label: 'Submitted',             approvalStage: null },
  { key: 'approved',              label: 'Approved for Office Submission', approvalStage: null },
  { key: 'under_review',          label: 'Under Review',          approvalStage: null },
  { key: 'for_review',            label: 'For Review',            approvalStage: 'for_review' },
  { key: 'for_approval',          label: 'Final Approval',        approvalStage: 'for_approval' },
  { key: 'released',              label: 'Released',              approvalStage: null },
]

function getProgressIndex(application) {
  const s = application.status
  const cs = application.linkedCase?.status ?? null
  const approvals = application.linkedCase?.approvals ?? []
  const approvedStages = new Set(approvals.filter(a => a.action === 'approved').map(a => a.stage))
  if (s === 'released') return 5
  if (s === 'disapproved') {
    const rejected = approvals.find(a => a.action === 'rejected')
    const map = { for_review: 3, recommending_approval: 4, for_approval: 4 }
    return rejected ? (map[rejected.stage] ?? 4) : 4
  }
  if (s === 'approved') {
    if (!application.linkedCase) return 1
    return application.linkedCase.status === 'approved' ? 4 : 2
  }
  if (s === 'under_review' || s === 'resubmission_required') {
    if (approvedStages.has('for_approval')) return 4
    if (approvedStages.has('recommending_approval')) return 4
    if (approvedStages.has('for_review')) return 3
    if (cs === 'for_review' || cs === 'recommending_approval' || cs === 'for_approval') return 3
    return 2
  }
  if (s === 'submitted') return 0
  return -1
}

function MiniStageBar({ application }) {
  const approvals = application.linkedCase?.approvals ?? []
  const progressIndex = getProgressIndex(application)
  const isDisapprovedApp = application.status === 'disapproved'

  return (
    <div className="flex items-center gap-1">
      {TRACKER_STEPS.map((step, index) => {
        const approval = step.approvalStage ? approvals.find(a => a.stage === step.approvalStage) : null
        const isCompleted = index < progressIndex || approval?.action === 'approved'
        const isActive = index === progressIndex && !isDisapprovedApp
        const isDisapproved = index === progressIndex && isDisapprovedApp
        const color = isCompleted ? 'bg-emerald-500'
          : isActive ? 'bg-blue-500'
          : isDisapproved ? 'bg-rose-500'
          : 'bg-slate-200'
        return (
          <div key={step.key} className="group relative flex flex-col items-center">
            <span className={`h-2 w-2 rounded-full ${color} ${isActive ? 'ring-2 ring-blue-300' : ''}`} />
            <span className="pointer-events-none absolute bottom-full mb-1.5 hidden whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function PortalApplicationsPage() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('submitted')
  const [adminNotes, setAdminNotes] = useState('')
  const [activeStep, setActiveStep] = useState('overview')
  const [activeNavKey, setActiveNavKey] = useState('applications')
  const [duplicateModal, setDuplicateModal] = useState(null)

  const selectedApplication = applications.find((application) => application.id === selectedId) || null

  const syncReviewState = (application) => {
    const effectiveStatus = application && statusOptions.includes(application.status) ? application.status : 'submitted'
    setStatus(effectiveStatus)
    setAdminNotes(application?.adminNotes || '')
    setActiveStep('overview')
  }

  const selectApplication = (application, nextNavKey = activeNavKey) => {
    setSelectedId(application?.id || null)
    syncReviewState(application || null)
    if (nextNavKey) {
      setActiveNavKey(nextNavKey)
    }
  }

  const loadApplications = async (targetPage = page, overrides = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const effectiveStatusFilter = overrides.statusFilter ?? statusFilter
      const effectiveSearch = overrides.search ?? search
      if (effectiveStatusFilter) params.set('status', effectiveStatusFilter)
      if (effectiveSearch.trim()) params.set('search', effectiveSearch.trim())
      params.set('page', String(targetPage))
      params.set('limit', '5')

      const res = await api.get(`/applicant-applications?${params.toString()}`)
      const nextApplications = res.data.applications || []

      setApplications(nextApplications)
      setTotal(res.data.total || 0)
      setTotalPages(res.data.totalPages || 1)
      setSelectedIds((current) => current.filter((id) => nextApplications.some((application) => application.id === id)))

      if (!selectedId && nextApplications[0]) {
        selectApplication(nextApplications[0], activeNavKey)
      } else if (selectedId && !nextApplications.some((application) => application.id === selectedId)) {
        selectApplication(nextApplications[0] || null, activeNavKey)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load portal applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadApplications(1, { search })
    }, 350)

    return () => clearTimeout(timer)
  }, [search])

  const updateSelectedApplication = async (nextStatus = status, options = {}) => {
    if (!selectedApplication) return null
    const {
      openCaseStudy = false,
      successMessage = 'Application status updated',
      createCase = false,
      reuseClientId = null,
      overrideDuplicateReason = null,
    } = options

    setSaving(true)
    try {
      const res = await api.patch(`/applicant-applications/${selectedApplication.id}/status`, {
        status: nextStatus,
        adminNotes,
        createCase,
        reuseClientId,
        overrideDuplicateReason,
      })

      const updated = res.data.application
      setApplications((current) => current.map((application) => (
        application.id === updated.id ? updated : application
      )))
      syncReviewState(updated)
      toast.success(successMessage)

      if (openCaseStudy && updated.linkedCase?.id) {
        navigate(`/cases/${updated.linkedCase.id}/case-study`)
      }

      return updated
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.matches) {
        setDuplicateModal({
          ...error.response.data,
          applicationId: selectedApplication.id,
        })
        return null
      }
      toast.error(error.response?.data?.message || 'Failed to update status')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSaveStatus = async () => {
    await updateSelectedApplication(status)
  }

  const handleApprove = async () => {
    await updateSelectedApplication('approved', {
      successMessage: 'Application approved for office submission',
    })
  }

  const handleCreateCase = async () => {
    if (!selectedApplication) return
    try {
      const preflight = await api.post(`/applicant-applications/${selectedApplication.id}/duplicate-check`)
      if (preflight.data?.duplicateStatus && preflight.data.duplicateStatus !== 'no_match') {
        setDuplicateModal({
          ...preflight.data,
          applicationId: selectedApplication.id,
        })
        return
      }
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.matches) {
        setDuplicateModal({
          ...error.response.data,
          applicationId: selectedApplication.id,
        })
        return
      }
    }

    await updateSelectedApplication('under_review', {
      openCaseStudy: true,
      successMessage: 'Staff case created and application moved to under review',
      createCase: true,
    })
  }

  const handleReject = async () => {
    await updateSelectedApplication('disapproved', {
      successMessage: 'Application rejected',
    })
  }

  const handleRequestResubmission = async () => {
    await updateSelectedApplication('resubmission_required', {
      successMessage: 'Applicant marked for resubmission',
    })
  }

  const handleToggleSelection = (applicationId) => {
    setSelectedIds((current) => (
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId]
    ))
  }

  const handleToggleSelectAll = () => {
    if (selectedIds.length === applications.length) {
      setSelectedIds([])
      return
    }

    setSelectedIds(applications.map((application) => application.id))
  }

  const handleDeleteSingle = async () => {
    if (!selectedApplication) return
    const confirmed = window.confirm('Delete this portal application? Linked staff cases will remain, but the portal application record and uploaded documents will be removed.')
    if (!confirmed) return

    setDeleting(true)
    try {
      await api.delete(`/applicant-applications/${selectedApplication.id}`)
      const nextApplications = applications.filter((application) => application.id !== selectedApplication.id)
      setApplications(nextApplications)
      setSelectedIds((current) => current.filter((id) => id !== selectedApplication.id))
      setSelectedId(nextApplications[0]?.id || null)
      toast.success('Portal application deleted')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete application')
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    const confirmed = window.confirm(`Delete ${selectedIds.length} selected portal application(s)? Linked staff cases will remain, but the portal application records and uploaded documents will be removed.`)
    if (!confirmed) return

    setDeleting(true)
    try {
      await api.post('/applicant-applications/bulk-delete', { ids: selectedIds })
      const nextApplications = applications.filter((application) => !selectedIds.includes(application.id))
      setApplications(nextApplications)
      setSelectedId((current) => (
        current && !selectedIds.includes(current)
          ? current
          : nextApplications[0]?.id || null
      ))
      setSelectedIds([])
      toast.success('Selected portal applications deleted')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to bulk delete applications')
    } finally {
      setDeleting(false)
    }
  }

  const canApprove = selectedApplication && !selectedApplication.linkedCase && !['approved', 'disapproved', 'released'].includes(selectedApplication.status)
  const canCreateCase = selectedApplication && !selectedApplication.linkedCase && selectedApplication.status === 'approved'
  const canReject = selectedApplication && !selectedApplication.linkedCase && selectedApplication.status !== 'disapproved'
  const canRequestResubmission = selectedApplication && !selectedApplication.linkedCase && !['approved', 'released', 'disapproved'].includes(selectedApplication.status)
  const decisionStatusOptions = statusOptions.filter((option) => {
    if (option === 'approved') return !selectedApplication?.linkedCase || selectedApplication?.status === 'approved'
    if (option === 'under_review') return !!selectedApplication?.linkedCase || selectedApplication?.status === 'under_review'
    return true
  })
  const activeStepIndex = reviewSteps.findIndex((step) => step.key === activeStep)
  const allSelected = applications.length > 0 && selectedIds.length === applications.length

  const goToNextStep = () => {
    if (activeStepIndex < 0 || activeStepIndex >= reviewSteps.length - 1) return
    const nextKey = reviewSteps[activeStepIndex + 1].key
    setActiveStep(nextKey)
    setActiveNavKey(nextKey)
  }

  const goToPreviousStep = () => {
    if (activeStepIndex <= 0) return
    const previousKey = reviewSteps[activeStepIndex - 1].key
    setActiveStep(previousKey)
    setActiveNavKey(previousKey)
  }

  const handleNavigate = (key) => {
    setActiveNavKey(key)
    if (reviewSteps.some((step) => step.key === key)) {
      setActiveStep(key)
    }
  }

  const handleUseExistingDuplicate = async (match) => {
    const updated = await updateSelectedApplication('under_review', {
      openCaseStudy: true,
      successMessage: 'Existing client reused and staff case created',
      createCase: true,
      reuseClientId: match.id,
    })
    if (updated) setDuplicateModal(null)
  }

  const handleCreateCaseAnyway = async (reason) => {
    const updated = await updateSelectedApplication('under_review', {
      openCaseStudy: true,
      successMessage: 'Staff case created with duplicate override',
      createCase: true,
      overrideDuplicateReason: reason,
    })
    if (updated) setDuplicateModal(null)
  }

  const navItems = [
    { key: 'applications', label: 'Applications', count: total },
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents' },
    { key: 'decision', label: 'Decision' },
    { key: 'monitoring', label: 'Application Monitoring' },
  ]

  const renderFunctionalView = () => {
    if (activeNavKey === 'applications') {
      return (
        <PortalApplicationsQueue
          loading={loading}
          applications={applications}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onSelectApplication={(id) => {
            const application = applications.find((item) => item.id === id) || null
            selectApplication(application, 'overview')
          }}
          onToggleSelection={handleToggleSelection}
          page={page}
          totalPages={totalPages}
          total={total}
          onChangePage={(nextPage) => {
            setPage(nextPage)
            loadApplications(nextPage)
          }}
        />
      )
    }

    if (activeNavKey === 'monitoring') {
      const monitorable = applications.filter(app => app.status !== 'draft')
      return (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="font-display text-base font-semibold text-slate-800">Application Monitoring</h3>
            <p className="text-xs text-slate-400 mt-0.5">Workflow tracker — current page</p>
          </div>
          {monitorable.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No applications to monitor on this page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header rounded-tl-lg text-left">Reference #</th>
                    <th className="table-header text-left">Applicant</th>
                    <th className="table-header text-left">Type</th>
                    <th className="table-header text-left">Status</th>
                    <th className="table-header text-left">Stage Progress</th>
                    <th className="table-header rounded-tr-lg text-left">Current Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {monitorable.map((app) => {
                    const progressIndex = getProgressIndex(app)
                    const activeStep = TRACKER_STEPS[progressIndex] ?? null
                    return (
                      <tr key={app.id} className="table-row">
                        <td className="table-cell font-mono text-xs font-semibold text-brand-primary">
                          {app.referenceNumber || '—'}
                        </td>
                        <td className="table-cell text-sm font-medium">
                          {app.applicant ? `${app.applicant.lastName}, ${app.applicant.firstName}` : '—'}
                        </td>
                        <td className="table-cell text-xs capitalize text-slate-600">
                          {app.assistanceType?.replace(/_/g, ' ') || '—'}
                        </td>
                        <td className="table-cell">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${APP_STATUS_CLASSES[app.status] || 'bg-slate-100 text-slate-600'}`}>
                            {app.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="table-cell">
                          <MiniStageBar application={app} />
                        </td>
                        <td className="table-cell text-xs text-slate-600">
                          {activeStep ? activeStep.label : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    }

    return (
      <PortalApplicationReviewPanel
        selectedApplication={selectedApplication}
        activeStep={activeStep}
        activeStepIndex={activeStepIndex}
        onPreviousStep={goToPreviousStep}
        onNextStep={goToNextStep}
        status={status}
        onStatusChange={setStatus}
        statusOptions={decisionStatusOptions}
        adminNotes={adminNotes}
        onAdminNotesChange={setAdminNotes}
        deleting={deleting}
        saving={saving}
        canApprove={canApprove}
        canCreateCase={canCreateCase}
        canReject={canReject}
        canRequestResubmission={canRequestResubmission}
        handleApprove={handleApprove}
        handleCreateCase={handleCreateCase}
        handleReject={handleReject}
        handleRequestResubmission={handleRequestResubmission}
        handleSaveStatus={handleSaveStatus}
        onDeleteDraft={handleDeleteSingle}
        onOpenCaseStudy={() => navigate(`/cases/${selectedApplication?.linkedCase?.id}/case-study`)}
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PortalApplicationsToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => {
          setStatusFilter(value)
          setPage(1)
          loadApplications(1, { statusFilter: value })
        }}
        loading={loading}
        applicationsCount={applications.length}
        allSelected={allSelected}
        selectedIdsCount={selectedIds.length}
        deleting={deleting}
        onToggleSelectAll={handleToggleSelectAll}
        onBulkDelete={handleBulkDelete}
        navItems={navItems}
        activeNavKey={activeNavKey}
        onNavigate={handleNavigate}
      />

      <div className="space-y-6">
        {renderFunctionalView()}
      </div>

      <DuplicateReviewModal
        open={!!duplicateModal}
        title="Possible duplicate client found for this portal applicant"
        message="Reusing the existing client keeps the staff case history in one profile. Create anyway only if the applicant is truly a different person."
        matches={duplicateModal?.matches || []}
        currentLinkedClient={duplicateModal?.currentLinkedClient || null}
        saving={saving}
        createAnywayLabel="Create case anyway"
        useExistingLabel="Use existing client"
        onClose={() => setDuplicateModal(null)}
        onUseExisting={handleUseExistingDuplicate}
        onCreateAnyway={handleCreateCaseAnyway}
        onViewProfile={(match) => navigate(`/clients/${match.id}`)}
      />
    </div>
  )
}
