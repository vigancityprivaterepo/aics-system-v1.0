import { formatStatus, reviewSteps, statusClasses } from './reviewerConfig'
import toast from 'react-hot-toast'
import api from '../../lib/api'

function OverviewSection({ application, deleting, onDeleteDraft, onOpenCaseStudy }) {
  const medicineSelections = Array.isArray(application.metadata?.medicineSelections)
    ? application.metadata.medicineSelections
        .filter((medicine) => medicine && typeof medicine === 'object')
        .map((medicine) => ({
          id: typeof medicine.id === 'string' ? medicine.id : `${medicine.genericName || 'medicine'}-${medicine.brandName || ''}`,
          genericName: typeof medicine.genericName === 'string' ? medicine.genericName : '',
          brandName: typeof medicine.brandName === 'string' ? medicine.brandName : '',
          unit: typeof medicine.unit === 'string' ? medicine.unit : '',
          strength: typeof medicine.strength === 'string' ? medicine.strength : '',
          category: typeof medicine.category === 'string' ? medicine.category : '',
        }))
        .filter((medicine) => medicine.genericName)
    : []

  const legacyMedicineSelection = application.metadata?.medicineGenericName
    ? [{
        id: 'legacy-medicine',
        genericName: application.metadata.medicineGenericName,
        brandName: application.metadata?.medicineBrandName || '',
        unit: application.metadata?.medicineUnit || '',
        strength: application.metadata?.medicineStrength || '',
        category: application.metadata?.medicineCategory || '',
      }]
    : []

  const displayMedicines = medicineSelections.length ? medicineSelections : legacyMedicineSelection

  return (
    <div className="space-y-5">
      {application.status === 'draft' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-700">Incomplete Draft</p>
          <p className="mt-1 text-xs text-slate-600">This application was started by the applicant but not yet submitted.</p>
          <button
            type="button"
            onClick={onDeleteDraft}
            disabled={deleting}
            className="mt-3 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          >
            Delete Draft
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">Applicant</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {application.applicant?.firstName} {application.applicant?.lastName}
          </p>
          <p className="mt-1 text-sm text-slate-500">{application.applicant?.email || 'No email provided'}</p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">Contact</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{application.contactNumber || 'Not provided'}</p>
          <p className="mt-1 text-sm text-slate-500">
            {application.applicant?.barangay || 'No barangay'}
            {application.applicant?.municipality ? `, ${application.applicant.municipality}` : ''}
          </p>
        </div>
      </div>

      {application.linkedCase && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-xs font-medium text-emerald-700">Linked Staff Case</p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">
            {application.linkedCase.caseNumber || 'Pending case number'}
          </p>
          <p className="mt-1 text-sm text-slate-600 capitalize">
            {application.linkedCase.assistanceType} assistance - {formatStatus(application.linkedCase.status)}
          </p>
          <button
            type="button"
            onClick={onOpenCaseStudy}
            className="portal-button-secondary mt-3 text-xs"
          >
            Open Case Study
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium text-slate-500">Reason</p>
        <p className="mt-2 text-sm leading-7 text-slate-700">{application.reason}</p>
      </div>

      {(application.assistanceType === 'medical' || application.assistanceType === 'hospital') && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Hospital Facility</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {application.metadata?.hospitalFacilityName || 'Not provided'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {[application.metadata?.hospitalMunicipality, application.metadata?.hospitalProvince].filter(Boolean).join(', ') || application.metadata?.hospitalFacilityAddress || ''}
          </p>
        </div>
      )}

      {application.assistanceType === 'medicine' && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Medicine Items</p>
          {displayMedicines.length ? (
            <div className="mt-2 space-y-3">
              {displayMedicines.map((medicine) => (
                <div key={medicine.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {medicine.genericName}
                    {medicine.brandName ? ` - ${medicine.brandName}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {[medicine.unit, medicine.strength, medicine.category].filter(Boolean).join(' - ') || 'No extra details'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-slate-800">Not provided</p>
          )}
        </div>
      )}
    </div>
  )
}

function DocumentsSection({ application }) {
  const handleOpenDocument = async (fileDocument) => {
    const previewWindow = window.open('', '_blank')
    try {
      const res = await api.get(`/applicant-applications/documents/${fileDocument.id}/file`, {
        responseType: 'blob',
      })
      const sourceBlob = res.data instanceof Blob
        ? res.data
        : new Blob([res.data], { type: fileDocument.mimeType || 'application/octet-stream' })
      const objectUrl = URL.createObjectURL(sourceBlob)
      if (previewWindow) {
        previewWindow.location.href = objectUrl
      } else {
        const link = window.document.createElement('a')
        link.href = objectUrl
        link.download = fileDocument.originalName || `${fileDocument.documentType}.pdf`
        window.document.body.appendChild(link)
        link.click()
        link.remove()
      }
    } catch (error) {
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
      toast.error(error.response?.data?.message || 'Failed to open document')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-medium text-slate-500">Uploaded Documents</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {application.documents?.length ? application.documents.map((document) => (
            <button
              key={document.id}
              type="button"
              onClick={() => handleOpenDocument(document)}
              className="flex min-h-[96px] items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-4 text-left text-sm transition-colors hover:border-emerald-600 hover:bg-emerald-50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold leading-6 text-slate-800">{document.documentType}</p>
                <p className="mt-2 break-words text-xs leading-5 text-slate-400">{document.originalName}</p>
              </div>
              <span className="text-xs font-medium text-emerald-700">Open ↗</span>
            </button>
          )) : (
            <p className="text-sm text-slate-500">No documents uploaded.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DecisionSection({
  status,
  statusOptions,
  onStatusChange,
  adminNotes,
  onAdminNotesChange,
  handleApprove,
  handleCreateCase,
  handleReject,
  handleRequestResubmission,
  handleSaveStatus,
  saving,
  canApprove,
  canCreateCase,
  canReject,
  canRequestResubmission,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Primary Decisions</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={saving || !canApprove}
            className="portal-button-green disabled:opacity-50"
          >
            Approve Application
          </button>
          <button
            type="button"
            onClick={handleCreateCase}
            disabled={saving || !canCreateCase}
            className="portal-button-primary disabled:opacity-50"
          >
            Create Staff Case
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleReject}
            disabled={saving || !canReject}
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
          >
            Reject Application
          </button>
        </div>
        <button
          type="button"
          onClick={handleRequestResubmission}
          disabled={saving || !canRequestResubmission}
          className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
        >
          Mark for Resubmission
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Review Update</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="portal-label">Update Status</label>
            <select value={status} onChange={(event) => onStatusChange(event.target.value)} className="portal-input">
              {statusOptions.map((option) => (
                <option key={option} value={option}>{formatStatus(option)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="portal-label">Admin Notes</label>
            <textarea
              rows="5"
              value={adminNotes}
              onChange={(event) => onAdminNotesChange(event.target.value)}
              className="portal-input"
              placeholder="Add review remarks, deficiencies, or release notes."
            />
          </div>
          <button type="button" onClick={handleSaveStatus} disabled={saving} className="portal-button-green disabled:opacity-50">
            Save Review Update
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PortalApplicationReviewPanel({
  selectedApplication,
  activeStep,
  activeStepIndex,
  onPreviousStep,
  onNextStep,
  status,
  statusOptions: availableStatusOptions,
  onStatusChange,
  adminNotes,
  onAdminNotesChange,
  deleting,
  saving,
  canApprove,
  canCreateCase,
  canReject,
  canRequestResubmission,
  handleApprove,
  handleCreateCase,
  handleReject,
  handleRequestResubmission,
  handleSaveStatus,
  onDeleteDraft,
  onOpenCaseStudy,
}) {
  if (!selectedApplication) {
    return (
      <section className="card border border-slate-200 bg-white shadow-sm">
        <div className="portal-empty min-h-[420px]">
          <p className="font-medium text-slate-500">Select an application to review</p>
        </div>
      </section>
    )
  }

  return (
    <section className="card border border-slate-200 bg-white shadow-sm">
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">{selectedApplication.referenceNumber || 'Pending reference number'}</h2>
              <p className="text-sm text-slate-500 capitalize mt-0.5">{selectedApplication.assistanceType} assistance</p>
              <p className="mt-2 text-xs font-medium text-slate-400">
                {reviewSteps[activeStepIndex]?.label || 'Overview'} Section
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[280px]">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-medium text-slate-400">Status</p>
                <span className={`mt-2 inline-flex badge ${statusClasses[selectedApplication.status] || statusClasses.submitted}`}>
                  {formatStatus(selectedApplication.status)}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-medium text-slate-400">Applicant</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {selectedApplication.applicant?.firstName} {selectedApplication.applicant?.lastName}
                </p>
                <p className="mt-1 text-xs text-slate-400">{selectedApplication.applicant?.email || 'No email provided'}</p>
              </div>
            </div>
          </div>
        </div>

        {activeStep === 'overview' && (
          <OverviewSection
            application={selectedApplication}
            deleting={deleting}
            onDeleteDraft={onDeleteDraft}
            onOpenCaseStudy={onOpenCaseStudy}
          />
        )}

        {activeStep === 'documents' && (
          <DocumentsSection application={selectedApplication} />
        )}

        {activeStep === 'decision' && (
          <DecisionSection
            status={status}
            statusOptions={availableStatusOptions}
            onStatusChange={onStatusChange}
            adminNotes={adminNotes}
            onAdminNotesChange={onAdminNotesChange}
            handleApprove={handleApprove}
            handleCreateCase={handleCreateCase}
            handleReject={handleReject}
            handleRequestResubmission={handleRequestResubmission}
            handleSaveStatus={handleSaveStatus}
            saving={saving}
            canApprove={canApprove}
            canCreateCase={canCreateCase}
            canReject={canReject}
            canRequestResubmission={canRequestResubmission}
          />
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onPreviousStep}
            disabled={activeStepIndex <= 0}
            className="portal-button-secondary text-xs disabled:opacity-50"
          >
            Back
          </button>
          <div className="text-xs text-slate-400">
            Step {activeStepIndex + 1} of {reviewSteps.length}
          </div>
          <button
            type="button"
            onClick={onNextStep}
            disabled={activeStepIndex >= reviewSteps.length - 1}
            className="portal-button-primary text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  )
}
